//! lora-rx — Receptor raw LoRa + servidor BLE GATT
//!
//! Pinout LR1121 → ESP32:
//!   CS=5  CLK=18  MOSI=23  MISO=19  RESET=33  BUSY=32
//!
//! BLE: anuncia como "LORA-RX-01", service 0xFF00, características 0xFF01–0xFF05.
//! Protocolo: JSON base64-encoded (ver CLAUDE.md y lib/protocol.ts).

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::PinDriver,
    peripherals::Peripherals,
    spi::{config::Config as SpiConfig, SpiDeviceDriver, SpiDriver, SPI2},
    units::Hertz,
};
use esp_idf_svc::log::EspLogger;
use esp32_nimble::{
    utilities::BleUuid, BLEAdvertisementData, BLEDevice, NimBLECharacteristicProperty,
};
use log::{error, info, warn};
use lr1121::{
    decode_packet, Lr1121,
    DEFAULT_BW_KHZ, DEFAULT_CR, DEFAULT_FREQ_HZ, DEFAULT_SF,
};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

// ─── UUIDs (16-bit, coinciden con protocol.ts a través de la base BT UUID) ───

const SVC:      BleUuid = BleUuid::from_uuid16(0xff00);
const CHAR_INFO:   BleUuid = BleUuid::from_uuid16(0xff01); // R
const CHAR_CFG:    BleUuid = BleUuid::from_uuid16(0xff02); // R/W
const CHAR_STATUS: BleUuid = BleUuid::from_uuid16(0xff03); // R
const CHAR_PKT:    BleUuid = BleUuid::from_uuid16(0xff04); // Notify
const CHAR_CMD:    BleUuid = BleUuid::from_uuid16(0xff05); // W

// ─── Modelos ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RadioConfig {
    #[serde(rename = "freqHz")]
    freq_hz: u32,
    sf: u8,
    #[serde(rename = "bwKhz")]
    bw_khz: u32,
    cr: String,
    #[serde(rename = "txPowerDbm")]
    tx_power_dbm: i8,
}

impl Default for RadioConfig {
    fn default() -> Self {
        Self {
            freq_hz: DEFAULT_FREQ_HZ,
            sf: DEFAULT_SF,
            bw_khz: DEFAULT_BW_KHZ,
            cr: DEFAULT_CR.to_string(),
            tx_power_dbm: 14,
        }
    }
}

#[derive(Serialize)]
struct PacketJson {
    seq: u16,
    rssi: f32,
    snr: f32,
    temp: f32,
    hum: f32,
    bat: f32,
}

#[derive(Deserialize)]
struct Command {
    cmd: String,
    #[serde(flatten)]
    payload: serde_json::Value,
}

fn b64_json<T: Serialize>(v: &T) -> Vec<u8> {
    let json = serde_json::to_string(v).unwrap_or_default();
    base64::encode(&json).into_bytes()
}

fn decode_b64_json(data: &[u8]) -> Option<String> {
    let s = std::str::from_utf8(data).ok()?;
    let decoded = base64::decode(s.trim()).ok()?;
    String::from_utf8(decoded).ok()
}

fn main() {
    esp_idf_svc::sys::link_patches();
    EspLogger::initialize_default();

    info!("lora-rx: iniciando");

    let p = Peripherals::take().unwrap();

    // ─── SPI ─────────────────────────────────────────────────────────────────
    let spi_driver = SpiDriver::new::<SPI2>(
        p.spi2,
        p.pins.gpio18,
        p.pins.gpio23,
        Some(p.pins.gpio19),
        &esp_idf_hal::spi::SpiDriverConfig::new(),
    ).expect("SPI driver");

    let spi = SpiDeviceDriver::new(
        spi_driver,
        Some(p.pins.gpio5),
        &SpiConfig::new().baudrate(Hertz(8_000_000)),
    ).expect("SPI device");

    let spi: esp_idf_hal::spi::SpiDeviceDriver<'static, _> = unsafe { core::mem::transmute(spi) };

    // ─── GPIO ─────────────────────────────────────────────────────────────────
    let busy  = PinDriver::input(p.pins.gpio32).expect("BUSY pin");
    let reset = PinDriver::output(p.pins.gpio33).expect("RESET pin");

    let busy: esp_idf_hal::gpio::PinDriver<'static, _>  = unsafe { core::mem::transmute(busy) };
    let reset: esp_idf_hal::gpio::PinDriver<'static, _> = unsafe { core::mem::transmute(reset) };

    // ─── Init LR1121 ─────────────────────────────────────────────────────────
    let mut radio = match Lr1121::new(spi, busy, reset) {
        Ok(r) => r,
        Err(e) => { error!("lr1121 init: {:?}", e); loop { FreeRtos::delay_ms(1000); } }
    };

    let cfg = Arc::new(Mutex::new(RadioConfig::default()));
    let reconfig_flag = Arc::new(AtomicBool::new(false));

    apply_rx_config(&mut radio, &cfg.lock().unwrap());
    radio.start_rx().expect("start_rx");

    info!("lora-rx: radio en RX continuo @ {:.3} MHz SF{} BW{}",
        DEFAULT_FREQ_HZ as f64 / 1e6, DEFAULT_SF, DEFAULT_BW_KHZ);

    // ─── BLE setup ───────────────────────────────────────────────────────────
    let ble = BLEDevice::take();
    let server = ble.get_server();

    let service = server.create_service(SVC);

    // CHAR_DEVICE_INFO: read → JSON estático
    let char_info = service.lock().create_characteristic(CHAR_INFO, NimBLECharacteristicProperty::READ);
    char_info.lock().set_value(&b64_json(&serde_json::json!({
        "name": "LORA-RX-01",
        "firmware": env!("CARGO_PKG_VERSION")
    })));

    // CHAR_RADIO_CONFIG: read/write
    let char_cfg_ble = service.lock().create_characteristic(
        CHAR_CFG,
        NimBLECharacteristicProperty::READ | NimBLECharacteristicProperty::WRITE,
    );
    char_cfg_ble.lock().set_value(&b64_json(&*cfg.lock().unwrap()));

    // CHAR_RADIO_STATUS: read
    let char_status = service.lock().create_characteristic(CHAR_STATUS, NimBLECharacteristicProperty::READ);
    char_status.lock().set_value(&b64_json(&serde_json::json!({"success": true})));

    // CHAR_PACKET_RX: notify
    let char_pkt = service.lock().create_characteristic(
        CHAR_PKT,
        NimBLECharacteristicProperty::READ | NimBLECharacteristicProperty::NOTIFY,
    );

    // CHAR_COMMAND: write — procesa SET_RADIO_CONFIG
    let char_cmd_ble = service.lock().create_characteristic(CHAR_CMD, NimBLECharacteristicProperty::WRITE);
    {
        let cfg_clone        = cfg.clone();
        let reconfig_clone   = reconfig_flag.clone();
        let char_cfg_ref     = char_cfg_ble.clone();
        let char_stat_ref    = char_status.clone();

        char_cmd_ble.lock().on_write(move |args| {
            let Some(json) = decode_b64_json(args.recv_data()) else { return };
            let Ok(cmd) = serde_json::from_str::<Command>(&json) else { return };

            if cmd.cmd == "SET_RADIO_CONFIG" {
                match serde_json::from_value::<RadioConfig>(cmd.payload) {
                    Ok(new_cfg) => {
                        info!("BLE SET_RADIO_CONFIG: {}Hz SF{} BW{}", new_cfg.freq_hz, new_cfg.sf, new_cfg.bw_khz);
                        *cfg_clone.lock().unwrap() = new_cfg.clone();
                        reconfig_clone.store(true, Ordering::Relaxed);
                        char_cfg_ref.lock().set_value(&b64_json(&new_cfg));
                        char_stat_ref.lock().set_value(&b64_json(&serde_json::json!({"success": true})));
                    }
                    Err(e) => {
                        warn!("SET_RADIO_CONFIG parse error: {}", e);
                        char_stat_ref.lock().set_value(&b64_json(&serde_json::json!({"success": false})));
                    }
                }
            }
        });
    }

    service.lock().start();

    // Advertising
    ble.get_advertising().lock()
        .set_data(
            BLEAdvertisementData::new()
                .name("LORA-RX-01")
                .add_service_uuid(SVC),
        )
        .expect("ble adv data");
    ble.get_advertising().lock().start().expect("ble adv start");

    info!("lora-rx: BLE advertising como \"LORA-RX-01\"");

    // ─── Main loop ───────────────────────────────────────────────────────────
    loop {
        if reconfig_flag.swap(false, Ordering::Relaxed) {
            let c = cfg.lock().unwrap().clone();
            apply_rx_config(&mut radio, &c);
            radio.start_rx().unwrap_or_else(|e| error!("start_rx: {:?}", e));
        }

        match radio.try_receive() {
            Ok(Some(pkt)) => {
                match decode_packet(&pkt.payload) {
                    Some((seq, temp, hum, bat)) => {
                        let json = PacketJson {
                            seq,
                            rssi: pkt.rssi_dbm as f32,
                            snr: pkt.snr_db as f32,
                            temp: temp as f32 / 100.0,
                            hum: hum as f32 / 100.0,
                            bat: bat as f32 / 1000.0,
                        };
                        info!("rx seq={} rssi={}dBm snr={}dB temp={:.2}°C",
                            seq, pkt.rssi_dbm, pkt.snr_db, json.temp);
                        char_pkt.lock().set_value(&b64_json(&json)).notify();
                    }
                    None => warn!("rx: CRC-8 inválido, paquete descartado"),
                }
            }
            Ok(None) => {} // sin paquete aún
            Err(lr1121::Lr1121Error::CrcError) => warn!("rx: error CRC LoRa"),
            Err(e) => error!("rx error: {:?}", e),
        }

        FreeRtos::delay_ms(10);
    }
}

fn apply_rx_config(radio: &mut Lr1121, cfg: &RadioConfig) {
    if let Err(e) = radio.configure_rx(cfg.freq_hz, cfg.sf, cfg.bw_khz, &cfg.cr) {
        error!("configure_rx error: {:?}", e);
    }
}
