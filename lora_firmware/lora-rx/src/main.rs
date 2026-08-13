//! lora-rx — Receptor raw LoRa + servidor BLE GATT
//!
//! Pinout LR1121 → ESP32:
//!   CS=5  CLK=18  MOSI=23  MISO=19  RESET=33  BUSY=32
//!
//! BLE: anuncia con el nombre guardado en NVS (default "LORA-RX-01"), service 0xFF00.
//! Protocolo: JSON base64-encoded (ver CLAUDE.md y lib/protocol.ts).
//!
//! NVS (namespace "lora_rx"):
//!   - "radio_cfg":   RadioConfig serializado como JSON
//!   - "device_name": nombre del gateway (string)
//!   - "wifi_ssid":   SSID de la red WiFi
//!   - "wifi_pass":   contraseña WiFi (sin cifrado adicional — el NVS cifrado de ESP-IDF
//!                    (Flash Encryption) protege estos datos en producción)

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{PinDriver, Pull},
    peripherals::Peripherals,
    spi::{config::Config as SpiConfig, SpiDeviceDriver, SpiDriver, SPI2},
    units::Hertz,
};
use esp_idf_svc::{
    eventloop::EspSystemEventLoop,
    log::EspLogger,
    nvs::{EspDefaultNvsPartition, EspNvs, NvsDefault},
    wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi},
};
use esp32_nimble::{
    utilities::BleUuid, BLEAdvertisementData, BLEDevice, NimbleProperties,
};
use log::{error, info, warn};
use lr1121::{
    decode_packet, encode_ack, Lr1121,
    DEFAULT_BW_KHZ, DEFAULT_CR, DEFAULT_FREQ_HZ, DEFAULT_SF,
};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

// ─── UUIDs (16-bit, coinciden con protocol.ts a través de la base BT UUID) ───

const SVC:         BleUuid = BleUuid::from_uuid16(0xff00);
const CHAR_INFO:   BleUuid = BleUuid::from_uuid16(0xff01); // R
const CHAR_CFG:    BleUuid = BleUuid::from_uuid16(0xff02); // R/W
const CHAR_STATUS: BleUuid = BleUuid::from_uuid16(0xff03); // R
const CHAR_PKT:    BleUuid = BleUuid::from_uuid16(0xff04); // Notify
const CHAR_CMD:    BleUuid = BleUuid::from_uuid16(0xff05); // W

// ─── NVS ──────────────────────────────────────────────────────────────────────

const NVS_NS:           &str = "lora_rx";
const NVS_KEY_RADIO:    &str = "radio_cfg";
const NVS_KEY_NAME:     &str = "device_name";
const NVS_KEY_WIFI_SSID: &str = "wifi_ssid";
const NVS_KEY_WIFI_PASS: &str = "wifi_pass";
const DEFAULT_DEVICE_NAME: &str = "LORA-RX-01";

fn load_nvs_config(nvs: &EspNvs<NvsDefault>) -> Option<RadioConfig> {
    let mut buf = [0u8; 256];
    match nvs.get_str(NVS_KEY_RADIO, &mut buf) {
        Ok(Some(json)) => serde_json::from_str(json).ok(),
        Ok(None) => None,
        Err(e) => { warn!("NVS read radio_cfg: {:?}", e); None }
    }
}

fn save_nvs_config(nvs: &mut EspNvs<NvsDefault>, cfg: &RadioConfig) {
    match serde_json::to_string(cfg) {
        Ok(json) => {
            if let Err(e) = nvs.set_str(NVS_KEY_RADIO, &json) {
                warn!("NVS write radio_cfg: {:?}", e);
            } else {
                info!("NVS: radio_cfg guardado");
            }
        }
        Err(e) => warn!("NVS serialize radio_cfg: {}", e),
    }
}

fn load_nvs_str(nvs: &EspNvs<NvsDefault>, key: &str) -> Option<String> {
    let mut buf = [0u8; 256];
    match nvs.get_str(key, &mut buf) {
        Ok(Some(s)) => Some(s.to_string()),
        Ok(None) => None,
        Err(e) => { warn!("NVS read '{}': {:?}", key, e); None }
    }
}

fn save_nvs_str(nvs: &mut EspNvs<NvsDefault>, key: &str, value: &str) {
    if let Err(e) = nvs.set_str(key, value) {
        warn!("NVS write '{}': {:?}", key, e);
    } else {
        info!("NVS: '{}' guardado", key);
    }
}

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

fn device_info_json(name: &str) -> serde_json::Value {
    serde_json::json!({
        "name":     name,
        "firmware": env!("CARGO_PKG_VERSION"),
        "role":     "gateway"
    })
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────

fn try_wifi_connect(wifi: &mut BlockingWifi<EspWifi<'static>>, ssid: &str, pass: &str) -> bool {
    let ssid_h = match heapless::String::<32>::try_from(ssid) {
        Ok(s) => s,
        Err(_) => { warn!("WiFi: SSID demasiado largo (máx 32 chars)"); return false; }
    };
    let pass_h = match heapless::String::<64>::try_from(pass) {
        Ok(s) => s,
        Err(_) => { warn!("WiFi: contraseña demasiado larga (máx 64 chars)"); return false; }
    };

    let _ = wifi.stop(); // detiene si ya estaba activo

    let cfg = Configuration::Client(ClientConfiguration {
        ssid: ssid_h,
        password: pass_h,
        auth_method: if pass.is_empty() { AuthMethod::None } else { AuthMethod::WPA2Personal },
        ..Default::default()
    });

    if let Err(e) = wifi.set_configuration(&cfg) {
        error!("WiFi set_configuration: {:?}", e);
        return false;
    }
    if let Err(e) = wifi.start() {
        error!("WiFi start: {:?}", e);
        return false;
    }

    info!("WiFi: conectando a '{}'…", ssid);
    if let Err(e) = wifi.connect() {
        error!("WiFi connect: {:?}", e);
        let _ = wifi.stop();
        return false;
    }

    match wifi.wait_netif_up() {
        Ok(()) => {
            if let Ok(ip) = wifi.wifi().sta_netif().get_ip_info() {
                info!("WiFi: conectado — IP={}", ip.ip);
            } else {
                info!("WiFi: conectado");
            }
            true
        }
        Err(e) => {
            error!("WiFi wait_netif_up: {:?}", e);
            let _ = wifi.stop();
            false
        }
    }
}

fn main() {
    esp_idf_svc::sys::link_patches();
    EspLogger::initialize_default();

    info!("lora-rx: iniciando");

    let p = Peripherals::take().unwrap();
    let modem = p.modem;

    // ─── NVS ─────────────────────────────────────────────────────────────────
    let nvs_partition = EspDefaultNvsPartition::take()
        .unwrap_or_else(|e| { error!("NVS partition: {:?}", e); panic!("NVS") });

    let mut nvs = EspNvs::new(nvs_partition.clone(), NVS_NS, true)
        .unwrap_or_else(|e| { error!("NVS namespace: {:?}", e); panic!("NVS") });

    let initial_cfg = load_nvs_config(&nvs).unwrap_or_else(|| {
        info!("NVS: sin radio_cfg, usando defaults");
        RadioConfig::default()
    });
    let boot_name = load_nvs_str(&nvs, NVS_KEY_NAME)
        .unwrap_or_else(|| DEFAULT_DEVICE_NAME.to_string());
    let boot_wifi_ssid = load_nvs_str(&nvs, NVS_KEY_WIFI_SSID);
    let boot_wifi_pass = load_nvs_str(&nvs, NVS_KEY_WIFI_PASS);

    info!("NVS: radio={}Hz SF{} BW{} | name='{}' | wifi={}",
        initial_cfg.freq_hz, initial_cfg.sf, initial_cfg.bw_khz,
        boot_name,
        boot_wifi_ssid.as_deref().unwrap_or("<sin config>"));

    // ─── WiFi init ───────────────────────────────────────────────────────────
    let sysloop = EspSystemEventLoop::take().expect("event loop");
    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(modem, sysloop.clone(), Some(nvs_partition.clone()))
            .expect("EspWifi::new"),
        sysloop,
    ).expect("BlockingWifi::wrap");

    // Auto-conectar si hay credenciales guardadas
    if let (Some(ssid), Some(pass)) = (boot_wifi_ssid, boot_wifi_pass) {
        info!("WiFi: credenciales en NVS, intentando auto-conectar…");
        if !try_wifi_connect(&mut wifi, &ssid, &pass) {
            warn!("WiFi: auto-conexión fallida — esperando nuevo SET_WIFI_CREDENTIALS");
        }
    }

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
    let busy  = PinDriver::input(p.pins.gpio32, Pull::Floating).expect("BUSY pin");
    let reset = PinDriver::output(p.pins.gpio33).expect("RESET pin");

    let busy: esp_idf_hal::gpio::PinDriver<'static, _>  = unsafe { core::mem::transmute(busy) };
    let reset: esp_idf_hal::gpio::PinDriver<'static, _> = unsafe { core::mem::transmute(reset) };

    // ─── Init LR1121 ─────────────────────────────────────────────────────────
    let mut radio = match Lr1121::new(spi, busy, reset) {
        Ok(r) => r,
        Err(e) => { error!("lr1121 init: {:?}", e); loop { FreeRtos::delay_ms(1000); } }
    };

    let cfg          = Arc::new(Mutex::new(initial_cfg));
    let device_name  = Arc::new(Mutex::new(boot_name.clone()));

    // Flags para el main loop
    let reconfig_flag     = Arc::new(AtomicBool::new(false));
    let save_radio_flag   = Arc::new(AtomicBool::new(false));
    let rename_flag       = Arc::new(AtomicBool::new(false));
    let wifi_connect_flag = Arc::new(AtomicBool::new(false));

    // Credenciales WiFi pendientes de aplicar (escritas desde callback BLE)
    let wifi_pending: Arc<Mutex<Option<(String, String)>>> = Arc::new(Mutex::new(None));

    apply_rx_config(&mut radio, &cfg.lock().unwrap());
    radio.start_rx().expect("start_rx");

    {
        let c = cfg.lock().unwrap();
        info!("lora-rx: radio en RX continuo @ {:.3} MHz SF{} BW{}",
            c.freq_hz as f64 / 1e6, c.sf, c.bw_khz);
    }

    // ─── BLE setup ───────────────────────────────────────────────────────────
    let ble = BLEDevice::take();
    let server = ble.get_server();

    let service = server.create_service(SVC);

    // CHAR_DEVICE_INFO: read → JSON con nombre actual
    let char_info = service.lock().create_characteristic(CHAR_INFO, NimbleProperties::READ);
    char_info.lock().set_value(&b64_json(&device_info_json(&boot_name)));

    // CHAR_RADIO_CONFIG: read/write
    let char_cfg_ble = service.lock().create_characteristic(
        CHAR_CFG,
        NimbleProperties::READ | NimbleProperties::WRITE,
    );
    char_cfg_ble.lock().set_value(&b64_json(&*cfg.lock().unwrap()));

    // CHAR_RADIO_STATUS: read
    let char_status = service.lock().create_characteristic(CHAR_STATUS, NimbleProperties::READ);
    char_status.lock().set_value(&b64_json(&serde_json::json!({"success": true})));

    // CHAR_PACKET_RX: notify
    let char_pkt = service.lock().create_characteristic(
        CHAR_PKT,
        NimbleProperties::READ | NimbleProperties::NOTIFY,
    );

    // CHAR_COMMAND: write — procesa SET_RADIO_CONFIG, SET_DEVICE_NAME, SET_WIFI_CREDENTIALS
    let char_cmd_ble = service.lock().create_characteristic(CHAR_CMD, NimbleProperties::WRITE);
    {
        let cfg_clone      = cfg.clone();
        let name_clone     = device_name.clone();
        let wifi_clone     = wifi_pending.clone();
        let reconfig_clone = reconfig_flag.clone();
        let save_r_clone   = save_radio_flag.clone();
        let rename_clone   = rename_flag.clone();
        let wifi_f_clone   = wifi_connect_flag.clone();
        let char_cfg_ref   = char_cfg_ble.clone();
        let char_stat_ref  = char_status.clone();
        let char_info_ref  = char_info.clone();

        char_cmd_ble.lock().on_write(move |args| {
            let Some(json) = decode_b64_json(args.recv_data()) else { return };
            let Ok(cmd) = serde_json::from_str::<Command>(&json) else { return };

            match cmd.cmd.as_str() {
                "SET_RADIO_CONFIG" => {
                    match serde_json::from_value::<RadioConfig>(cmd.payload) {
                        Ok(new_cfg) => {
                            info!("BLE SET_RADIO_CONFIG: {}Hz SF{} BW{}",
                                new_cfg.freq_hz, new_cfg.sf, new_cfg.bw_khz);
                            *cfg_clone.lock().unwrap() = new_cfg.clone();
                            reconfig_clone.store(true, Ordering::Relaxed);
                            save_r_clone.store(true, Ordering::Relaxed);
                            char_cfg_ref.lock().set_value(&b64_json(&new_cfg));
                            char_stat_ref.lock().set_value(
                                &b64_json(&serde_json::json!({"success": true}))
                            );
                        }
                        Err(e) => {
                            warn!("SET_RADIO_CONFIG parse error: {}", e);
                            char_stat_ref.lock().set_value(
                                &b64_json(&serde_json::json!({"success": false}))
                            );
                        }
                    }
                }

                "SET_DEVICE_NAME" => {
                    let name = cmd.payload["name"].as_str().unwrap_or("").trim().to_string();
                    if name.is_empty() {
                        warn!("SET_DEVICE_NAME: nombre vacío, ignorado");
                        char_stat_ref.lock().set_value(
                            &b64_json(&serde_json::json!({"success": false}))
                        );
                        return;
                    }
                    info!("BLE SET_DEVICE_NAME: '{}'", name);
                    *name_clone.lock().unwrap() = name.clone();
                    // Actualizar CHAR_INFO inmediatamente para lecturas posteriores
                    char_info_ref.lock().set_value(&b64_json(&serde_json::json!({
                        "name":     name,
                        "firmware": env!("CARGO_PKG_VERSION"),
                        "role":     "gateway"
                    })));
                    rename_clone.store(true, Ordering::Relaxed); // advertising + NVS en main loop
                    char_stat_ref.lock().set_value(
                        &b64_json(&serde_json::json!({"success": true}))
                    );
                }

                "SET_WIFI_CREDENTIALS" => {
                    let ssid = cmd.payload["ssid"].as_str().unwrap_or("").trim().to_string();
                    let pass = cmd.payload["password"].as_str().unwrap_or("").to_string();
                    if ssid.is_empty() {
                        warn!("SET_WIFI_CREDENTIALS: SSID vacío, ignorado");
                        char_stat_ref.lock().set_value(
                            &b64_json(&serde_json::json!({"success": false}))
                        );
                        return;
                    }
                    info!("BLE SET_WIFI_CREDENTIALS: ssid='{}'", ssid);
                    *wifi_clone.lock().unwrap() = Some((ssid, pass));
                    wifi_f_clone.store(true, Ordering::Relaxed);
                    char_stat_ref.lock().set_value(
                        &b64_json(&serde_json::json!({"success": true}))
                    );
                }

                other => warn!("BLE: comando desconocido '{}'", other),
            }
        });
    }

    // Advertising
    ble.get_advertising().lock()
        .set_data(
            BLEAdvertisementData::new()
                .name(&boot_name)
                .add_service_uuid(SVC),
        )
        .expect("ble adv data");
    ble.get_advertising().lock().start().expect("ble adv start");

    info!("lora-rx: BLE advertising como \"{}\"", boot_name);

    // ─── Main loop ───────────────────────────────────────────────────────────
    loop {
        // Reconfigurar radio si llegó SET_RADIO_CONFIG
        if reconfig_flag.swap(false, Ordering::Relaxed) {
            let c = cfg.lock().unwrap().clone();
            apply_rx_config(&mut radio, &c);
            radio.start_rx().unwrap_or_else(|e| error!("start_rx: {:?}", e));
        }

        // Persistir RadioConfig en NVS
        if save_radio_flag.swap(false, Ordering::Relaxed) {
            let c = cfg.lock().unwrap().clone();
            save_nvs_config(&mut nvs, &c);
        }

        // Actualizar advertising BLE y persistir nombre en NVS
        if rename_flag.swap(false, Ordering::Relaxed) {
            let new_name = device_name.lock().unwrap().clone();
            save_nvs_str(&mut nvs, NVS_KEY_NAME, &new_name);
            ble.get_advertising().lock()
                .set_data(
                    BLEAdvertisementData::new()
                        .name(&new_name)
                        .add_service_uuid(SVC),
                )
                .unwrap_or_else(|e| warn!("ble adv update: {:?}", e));
            ble.get_advertising().lock().start()
                .unwrap_or_else(|e| warn!("ble adv restart: {:?}", e));
            info!("BLE: advertising actualizado como '{}'", new_name);
        }

        // Intentar conexión WiFi con nuevas credenciales
        if wifi_connect_flag.swap(false, Ordering::Relaxed) {
            let creds = wifi_pending.lock().unwrap().take();
            if let Some((ssid, pass)) = creds {
                // Persistir credenciales antes de intentar la conexión
                save_nvs_str(&mut nvs, NVS_KEY_WIFI_SSID, &ssid);
                save_nvs_str(&mut nvs, NVS_KEY_WIFI_PASS, &pass);
                info!("WiFi: intentando conectar a '{}'…", ssid);
                if try_wifi_connect(&mut wifi, &ssid, &pass) {
                    info!("WiFi: listo para forwardear paquetes");
                } else {
                    warn!("WiFi: conexión fallida — reintentará en el próximo SET_WIFI_CREDENTIALS");
                }
                // Reanudar RX después del bloqueo WiFi
                radio.start_rx().unwrap_or_else(|e| error!("start_rx post-wifi: {:?}", e));
            }
        }

        // Recepción LoRa
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

                        // C2: ACK downlink
                        let cfg_snap = cfg.lock().unwrap().clone();
                        let ack = encode_ack(seq, pkt.rssi_dbm, pkt.snr_db, true);
                        if let Err(e) = radio.transmit_ack_and_return_rx(
                            &ack,
                            cfg_snap.freq_hz, cfg_snap.sf, cfg_snap.bw_khz,
                            &cfg_snap.cr, cfg_snap.tx_power_dbm,
                        ) {
                            error!("ack tx: {:?}", e);
                            radio.start_rx().unwrap_or_else(|e| error!("start_rx: {:?}", e));
                        } else {
                            info!("ack enviado seq={}", seq);
                        }
                    }
                    None => warn!("rx: CRC-8 inválido, paquete descartado"),
                }
            }
            Ok(None) => {}
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
