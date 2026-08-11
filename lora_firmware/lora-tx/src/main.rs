//! lora-tx — Nodo transmisor raw LoRa
//!
//! Pinout LR1121 → ESP32:
//!   CS=5  CLK=18  MOSI=23  MISO=19  RESET=33  BUSY=32
//!
//! Transmite un paquete de 9 bytes cada 2 segundos con datos mock.
//! No tiene BLE. Ver formato en CLAUDE.md / lr1121::encode_packet().

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::PinDriver,
    peripherals::Peripherals,
    spi::{config::Config as SpiConfig, SpiDeviceDriver, SpiDriver, SPI2},
    units::Hertz,
};
use esp_idf_svc::log::EspLogger;
use log::{error, info};
use lr1121::{
    decode_packet, encode_packet, Lr1121,
    DEFAULT_BW_KHZ, DEFAULT_CR, DEFAULT_FREQ_HZ, DEFAULT_SF, DEFAULT_TX_DBM,
};

fn main() {
    esp_idf_svc::sys::link_patches();
    EspLogger::initialize_default();

    info!("lora-tx: iniciando");

    let p = Peripherals::take().unwrap();

    // ─── SPI ─────────────────────────────────────────────────────────────────
    let spi_driver = SpiDriver::new::<SPI2>(
        p.spi2,
        p.pins.gpio18, // CLK
        p.pins.gpio23, // MOSI
        Some(p.pins.gpio19), // MISO
        &esp_idf_hal::spi::SpiDriverConfig::new(),
    ).expect("SPI driver");

    let spi = SpiDeviceDriver::new(
        spi_driver,
        Some(p.pins.gpio5), // CS
        &SpiConfig::new().baudrate(Hertz(8_000_000)),
    ).expect("SPI device");

    // Safety: los drivers se mueven al HalCtx estático dentro de Lr1121::new()
    let spi: esp_idf_hal::spi::SpiDeviceDriver<'static, _> = unsafe { core::mem::transmute(spi) };

    // ─── GPIO ─────────────────────────────────────────────────────────────────
    let busy  = PinDriver::input(p.pins.gpio32).expect("BUSY pin");
    let reset = PinDriver::output(p.pins.gpio33).expect("RESET pin");

    let busy: esp_idf_hal::gpio::PinDriver<'static, _> = unsafe { core::mem::transmute(busy) };
    let reset: esp_idf_hal::gpio::PinDriver<'static, _> = unsafe { core::mem::transmute(reset) };

    // ─── Init LR1121 ─────────────────────────────────────────────────────────
    let mut radio = match Lr1121::new(spi, busy, reset) {
        Ok(r) => r,
        Err(e) => { error!("lr1121 init: {:?}", e); loop { FreeRtos::delay_ms(1000); } }
    };

    const PAYLOAD_LEN: u8 = 9;

    if let Err(e) = radio.configure_tx(
        DEFAULT_FREQ_HZ, DEFAULT_SF, DEFAULT_BW_KHZ, DEFAULT_CR, DEFAULT_TX_DBM, PAYLOAD_LEN,
    ) {
        error!("lr1121 configure_tx: {:?}", e);
        loop { FreeRtos::delay_ms(1000); }
    }

    info!("lora-tx: radio lista @ {:.3} MHz SF{} BW{} {} {} dBm",
        DEFAULT_FREQ_HZ as f64 / 1e6, DEFAULT_SF, DEFAULT_BW_KHZ, DEFAULT_CR, DEFAULT_TX_DBM);

    // ─── TX loop ─────────────────────────────────────────────────────────────
    let mut mock = MockSensors::new();
    loop {
        let (seq, temp, hum, bat) = mock.next();
        let pkt = encode_packet(seq, temp, hum, bat);

        match radio.transmit(&pkt) {
            Ok(()) => info!("tx seq={} temp={:.2}°C hum={:.2}% bat={:.3}V",
                seq, temp as f32 / 100.0, hum as f32 / 100.0, bat as f32 / 1000.0),
            Err(e) => error!("tx error: {:?}", e),
        }

        FreeRtos::delay_ms(2_000);
    }
}

// ─── Generador de datos mock ───────────────────────────────────────────────────

struct MockSensors {
    seq: u16,
    temp_steps: i32, // 0–80 pasos de 0.1°C → 20.0–28.0°C
    dir: i32,
}

impl MockSensors {
    fn new() -> Self { Self { seq: 0, temp_steps: 0, dir: 1 } }

    /// Retorna (seq, temp×100, hum×100, bat_mV).
    fn next(&mut self) -> (u16, i16, u16, u16) {
        let seq = self.seq;
        self.seq = self.seq.wrapping_add(1);

        // Temperatura: triángulo 20.00–28.00°C
        self.temp_steps += self.dir;
        if self.temp_steps >= 80 { self.dir = -1; }
        if self.temp_steps <= 0  { self.dir = 1; }

        let temp_c100 = (2000 + self.temp_steps * 10) as i16;
        // Humedad correlacionada: 60–75 %
        let hum_c100  = (6000 + self.temp_steps * 18) as u16;
        let bat_mv    = 3900u16;

        (seq, temp_c100, hum_c100, bat_mv)
    }
}
