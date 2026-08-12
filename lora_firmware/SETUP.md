# Firmware ESP32 — Setup y flashing

## Estado actual

- `lora-tx`: completo. TX raw LoRa cada 2s, datos mock.
- `lora-rx`: completo. RX raw LoRa + BLE GATT server + persistencia NVS de RadioConfig.
- Toolchain Rust ESP32: **pendiente** — falta el target `xtensa-esp32-espidf` y el `export-esp.sh`.

---

## Setup del toolchain (hacer una sola vez)

```bash
# 1. Reinstalar espup — instala el target xtensa-esp32-espidf y crea ~/export-esp.sh
espup install

# 2. Sourcear el entorno y dejarlo permanente
. ~/export-esp.sh
echo '. ~/export-esp.sh' >> ~/.bashrc

# 3. Permisos para el puerto USB serie (Arch Linux usa el grupo uucp)
sudo usermod -aG uucp $USER
newgrp uucp
```

---

## Pinout LR1121 → ESP32

| LR1121 | ESP32   |
|--------|---------|
| 3.3V   | 3V3     |
| GND    | GND     |
| CS     | GPIO5   |
| CLK    | GPIO18  |
| MOSI   | GPIO23  |
| MISO   | GPIO19  |
| RESET  | GPIO33  |
| BUSY   | GPIO32  |

Dos conjuntos ESP32+LR1121: uno como `lora-tx`, otro como `lora-rx`.
Antena LoRa en LORA_ANT. DIO7/8/9 no conectados.

---

## Flashear

### Verificar el puerto USB
```bash
ls /dev/ttyUSB* /dev/ttyACM*
# Suele aparecer /dev/ttyUSB0 o /dev/ttyACM0
```

### lora-rx (receptor + BLE — conecta a la app)
```bash
cd /home/nacho/mega/codigo/lora/lora_firmware/lora-rx
cargo build --release
espflash flash --monitor target/xtensa-esp32-espidf/release/lora-rx
```

### lora-tx (transmisor — funciona autónomamente)
```bash
cd /home/nacho/mega/codigo/lora/lora_firmware/lora-tx
cargo build --release
espflash flash --monitor target/xtensa-esp32-espidf/release/lora-tx
```

`--monitor` abre el serial para ver logs. Salir: `Ctrl+C`.

---

## Verificación post-flash

**lora-tx** debe loguear cada 2s:
```
tx seq=0 temp=20.00°C hum=60.00% bat=3.900V
tx seq=1 ...
```

**lora-rx** debe loguear al recibir:
```
lora-rx: radio en RX continuo @ 916.800 MHz SF7 BW125
lora-rx: BLE advertising como "LORA-RX-01"
rx seq=0 rssi=-72dBm snr=8dB temp=20.00°C
```

Si el RSSI es 0 o el LR1121 no inicializa → revisar el pinout SPI.

---

## Conectar la app

1. Abrir la app Android (modo simulado por defecto).
2. Tocar **CONECTAR** en la pantalla Monitor.
3. Tocar **Buscar dispositivos** — debe aparecer `LORA-RX-01`.
4. Tocar **Conectar**.

La app cambia a "BLE CONECTADO" y empieza a mostrar los paquetes reales.

---

## Frecuencia de trabajo

`916.8 MHz, SF7, BW125, CR 4/5, TX 14 dBm` (AU915 sub-band 2 ch8).
Configurable desde la tab Config de la app — el cambio persiste en NVS del ESP32.
