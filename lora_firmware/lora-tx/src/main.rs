//! lora-tx — Nodo transmisor LoRa con BLE GATT (C1)
//!
//! Pinout LR1121 → ESP32: CS=5  CLK=18  MOSI=23  MISO=19  RESET=33  BUSY=32
//!
//! Transmite un paquete de 9 bytes cada `interval_ms` ms.
//! Tras cada TX escucha ~400 ms por el ACK downlink del gateway (C2).
//! El ACK recibido se expone vía CHAR_ACK_RX (0xFF06, Notify) para la app.
//!
//! Comandos BLE (CHAR_COMMAND):
//!   PAUSE_TX             → detiene el loop automático
//!   RESUME_TX            → reactiva el loop
//!   SEND_ONE             → envía un paquete inmediato (sin importar running)
//!   SET_TX_INTERVAL      → { "intervalMs": N } — cambia el período
//!   SET_RADIO_CONFIG     → RadioConfig JSON

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{PinDriver, Pull},
    peripherals::Peripherals,
    spi::{config::Config as SpiConfig, SpiDeviceDriver, SpiDriver, SPI2},
    units::Hertz,
};
use esp_idf_svc::log::EspLogger;
use esp32_nimble::{utilities::BleUuid, BLEAdvertisementData, BLEDevice, NimbleProperties};
use log::{error, info, warn};
use lr1121::{
    decode_ack, encode_packet, Lr1121,
    DEFAULT_BW_KHZ, DEFAULT_CR, DEFAULT_FREQ_HZ, DEFAULT_SF, DEFAULT_TX_DBM,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

// ─── UUIDs (coinciden con protocol.ts) ───────────────────────────────────────

const SVC:         BleUuid = BleUuid::from_uuid16(0xff00);
const CHAR_INFO:   BleUuid = BleUuid::from_uuid16(0xff01); // R
const CHAR_CFG:    BleUuid = BleUuid::from_uuid16(0xff02); // R/W
const CHAR_STATUS: BleUuid = BleUuid::from_uuid16(0xff03); // R
const CHAR_ACK_RX: BleUuid = BleUuid::from_uuid16(0xff06); // Notify (node only)
const CHAR_CMD:    BleUuid = BleUuid::from_uuid16(0xff05); // W

const ACK_WINDOW_MS:         u32 = 400;
const DEFAULT_INTERVAL_MS:   u32 = 2_000;
const TX_PAYLOAD_LEN:        u8  = 9;

// ─── Modelos ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RadioConfig {
    #[serde(rename = "freqHz")]   freq_hz:       u32,
    #[serde(rename = "bwKhz")]    bw_khz:        u32,
                                  sf:            u8,
                                  cr:            String,
    #[serde(rename = "txPowerDbm")] tx_power_dbm: i8,
}

impl Default for RadioConfig {
    fn default() -> Self {
        Self {
            freq_hz:      DEFAULT_FREQ_HZ,
            sf:           DEFAULT_SF,
            bw_khz:       DEFAULT_BW_KHZ,
            cr:           DEFAULT_CR.to_string(),
            tx_power_dbm: DEFAULT_TX_DBM,
        }
    }
}

#[derive(Deserialize)]
struct Command {
    cmd: String,
    #[serde(flatten)]
    payload: serde_json::Value,
}

struct TxState {
    running:      bool,
    interval_ms:  u32,
    send_one:     bool,
    reconfig:     Option<RadioConfig>,
    radio_config: RadioConfig,
}

impl Default for TxState {
    fn default() -> Self {
        Self {
            running:      true,
            interval_ms:  DEFAULT_INTERVAL_MS,
            send_one:     false,
            reconfig:     None,
            radio_config: RadioConfig::default(),
        }
    }
}

// ─── BLE helpers ──────────────────────────────────────────────────────────────

fn b64_json<T: Serialize>(v: &T) -> Vec<u8> {
    base64::encode(serde_json::to_string(v).unwrap_or_default()).into_bytes()
}

fn decode_b64_json(data: &[u8]) -> Option<String> {
    let s = std::str::from_utf8(data).ok()?;
    String::from_utf8(base64::decode(s.trim()).ok()?).ok()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    esp_idf_svc::sys::link_patches();
    EspLogger::initialize_default();

    info!("lora-tx: iniciando");

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
    let busy  = PinDriver::input(p.pins.gpio32, Pull::Floating).expect("BUSY");
    let reset = PinDriver::output(p.pins.gpio33).expect("RESET");

    let busy:  esp_idf_hal::gpio::PinDriver<'static, _> = unsafe { core::mem::transmute(busy) };
    let reset: esp_idf_hal::gpio::PinDriver<'static, _> = unsafe { core::mem::transmute(reset) };

    // ─── Init LR1121 ─────────────────────────────────────────────────────────
    let mut radio = match Lr1121::new(spi, busy, reset) {
        Ok(r) => r,
        Err(e) => { error!("lr1121 init: {:?}", e); loop { FreeRtos::delay_ms(1000); } }
    };

    let state = Arc::new(Mutex::new(TxState::default()));

    {
        let s = state.lock().unwrap();
        if let Err(e) = radio.configure_tx(
            s.radio_config.freq_hz, s.radio_config.sf, s.radio_config.bw_khz,
            &s.radio_config.cr, s.radio_config.tx_power_dbm, TX_PAYLOAD_LEN,
        ) {
            error!("configure_tx inicial: {:?}", e);
        }
    }

    info!("lora-tx: radio lista @ {:.3} MHz SF{} BW{}",
        DEFAULT_FREQ_HZ as f64 / 1e6, DEFAULT_SF, DEFAULT_BW_KHZ);

    // ─── BLE setup ───────────────────────────────────────────────────────────
    let ble = BLEDevice::take();
    let server = ble.get_server();
    let service = server.create_service(SVC);

    // CHAR_DEVICE_INFO
    let char_info = service.lock().create_characteristic(CHAR_INFO, NimbleProperties::READ);
    char_info.lock().set_value(&b64_json(&serde_json::json!({
        "name":     "LORA-TX-01",
        "firmware": env!("CARGO_PKG_VERSION"),
        "role":     "node"
    })));

    // CHAR_RADIO_CONFIG
    let char_cfg_ble = service.lock().create_characteristic(
        CHAR_CFG, NimbleProperties::READ | NimbleProperties::WRITE,
    );
    char_cfg_ble.lock().set_value(&b64_json(&RadioConfig::default()));

    // CHAR_RADIO_STATUS
    let char_status = service.lock().create_characteristic(CHAR_STATUS, NimbleProperties::READ);
    char_status.lock().set_value(&b64_json(&serde_json::json!({"success": true})));

    // CHAR_ACK_RX — nodo expone aquí el último ACK recibido del gateway
    let char_ack_rx = service.lock().create_characteristic(
        CHAR_ACK_RX, NimbleProperties::READ | NimbleProperties::NOTIFY,
    );

    // CHAR_COMMAND
    let char_cmd = service.lock().create_characteristic(CHAR_CMD, NimbleProperties::WRITE);
    {
        let state_c     = state.clone();
        let char_cfg_c  = char_cfg_ble.clone();
        let char_stat_c = char_status.clone();

        char_cmd.lock().on_write(move |args| {
            let Some(json) = decode_b64_json(args.recv_data()) else { return };
            let Ok(cmd)    = serde_json::from_str::<Command>(&json) else { return };

            let mut s = state_c.lock().unwrap();
            match cmd.cmd.as_str() {
                "PAUSE_TX"  => { s.running = false; info!("BLE: PAUSE_TX"); }
                "RESUME_TX" => { s.running = true;  info!("BLE: RESUME_TX"); }
                "SEND_ONE"  => { s.send_one = true;  info!("BLE: SEND_ONE"); }
                "SET_TX_INTERVAL" => {
                    if let Some(ms) = cmd.payload.get("intervalMs").and_then(|v| v.as_u64()) {
                        s.interval_ms = (ms as u32).clamp(500, 60_000);
                        info!("BLE: SET_TX_INTERVAL {}ms", s.interval_ms);
                    }
                }
                "SET_RADIO_CONFIG" => {
                    match serde_json::from_value::<RadioConfig>(cmd.payload.clone()) {
                        Ok(cfg) => {
                            info!("BLE: SET_RADIO_CONFIG {}Hz SF{}", cfg.freq_hz, cfg.sf);
                            char_cfg_c.lock().set_value(&b64_json(&cfg));
                            char_stat_c.lock().set_value(&b64_json(&serde_json::json!({"success": true})));
                            s.reconfig = Some(cfg);
                        }
                        Err(e) => {
                            warn!("SET_RADIO_CONFIG parse error: {}", e);
                            char_stat_c.lock().set_value(&b64_json(&serde_json::json!({"success": false})));
                        }
                    }
                }
                other => warn!("BLE: comando desconocido: {}", other),
            }
        });
    }

    // Advertising
    ble.get_advertising().lock()
        .set_data(
            BLEAdvertisementData::new()
                .name("LORA-TX-01")
                .add_service_uuid(SVC),
        )
        .expect("ble adv data");
    ble.get_advertising().lock().start().expect("ble adv start");

    info!("lora-tx: BLE advertising como \"LORA-TX-01\"");

    // ─── TX loop ─────────────────────────────────────────────────────────────
    let mut mock = MockSensors::new();

    loop {
        // Aplicar reconfiguración de radio pendiente
        let reconfig = state.lock().unwrap().reconfig.take();
        if let Some(new_cfg) = reconfig {
            if let Err(e) = radio.configure_tx(
                new_cfg.freq_hz, new_cfg.sf, new_cfg.bw_khz,
                &new_cfg.cr, new_cfg.tx_power_dbm, TX_PAYLOAD_LEN,
            ) {
                error!("configure_tx reconfig: {:?}", e);
            } else {
                info!("radio reconfigurada: {}Hz SF{}", new_cfg.freq_hz, new_cfg.sf);
                state.lock().unwrap().radio_config = new_cfg;
            }
        }

        // Decidir si transmitir
        let (should_tx, is_oneshot) = {
            let mut s = state.lock().unwrap();
            let one = s.send_one;
            s.send_one = false;
            (s.running || one, one && !s.running)
        };

        if should_tx {
            let cfg = state.lock().unwrap().radio_config.clone();
            let (seq, temp, hum, bat) = mock.next();
            let pkt = encode_packet(seq, temp, hum, bat);

            match radio.transmit(&pkt) {
                Ok(()) => {
                    info!("tx seq={}", seq);

                    // Ventana RX para ACK downlink del gateway
                    match radio.receive_with_timeout_ms(
                        cfg.freq_hz, cfg.sf, cfg.bw_khz, &cfg.cr,
                        ACK_WINDOW_MS,
                    ) {
                        Ok(Some(ack_pkt)) => {
                            match decode_ack(&ack_pkt.payload) {
                                Some((seq_ack, rssi_gw, snr_gw, delivered)) => {
                                    info!("ack seq={} rssiGw={}dBm snrGw={}dB", seq_ack, rssi_gw, snr_gw);
                                    let json = serde_json::json!({
                                        "seqAck":    seq_ack,
                                        "rssiGw":    rssi_gw,
                                        "snrGw":     snr_gw,
                                        "delivered": delivered,
                                    });
                                    char_ack_rx.lock().set_value(&b64_json(&json)).notify();
                                }
                                None => warn!("ack: CRC inválido"),
                            }
                        }
                        Ok(None) => {} // timeout — sin ACK, es normal si el gateway no escuchó
                        Err(e)   => warn!("ack rx: {:?}", e),
                    }

                    // Volver a TX mode para el próximo ciclo
                    if let Err(e) = radio.configure_tx(
                        cfg.freq_hz, cfg.sf, cfg.bw_khz,
                        &cfg.cr, cfg.tx_power_dbm, TX_PAYLOAD_LEN,
                    ) {
                        error!("configure_tx post-ack: {:?}", e);
                    }
                }
                Err(e) => error!("tx error: {:?}", e),
            }

            if !is_oneshot {
                let interval = state.lock().unwrap().interval_ms;
                FreeRtos::delay_ms(interval);
            }
        } else {
            // Pausado: yield breve para no quemar CPU
            FreeRtos::delay_ms(50);
        }
    }
}

// ─── Generador de datos mock ───────────────────────────────────────────────────

struct MockSensors { seq: u16, temp_steps: i32, dir: i32 }

impl MockSensors {
    fn new() -> Self { Self { seq: 0, temp_steps: 0, dir: 1 } }

    fn next(&mut self) -> (u16, i16, u16, u16) {
        let seq = self.seq;
        self.seq = self.seq.wrapping_add(1);
        self.temp_steps += self.dir;
        if self.temp_steps >= 80 { self.dir = -1; }
        if self.temp_steps <= 0  { self.dir = 1; }
        let temp_c100 = (2000 + self.temp_steps * 10) as i16;
        let hum_c100  = (6000 + self.temp_steps * 18) as u16;
        (seq, temp_c100, hum_c100, 3900u16)
    }
}
