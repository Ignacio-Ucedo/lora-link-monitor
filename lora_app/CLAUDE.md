# CLAUDE.md — LoRa Link Monitor

Herramienta completa de caracterización de enlace LoRa, compuesta por:
- **App Android** (Expo + React Native): monitoreo BLE en tiempo real
- **Firmware ESP32** (`firmware/`): dos binarios Rust, uno por rol

La comunicación BLE es el canal de configuración y diagnóstico.
El enlace que se mide es el RF LoRa entre nodo transmisor y receptor.

## Objetivo

Responder en todo momento: *"¿El enlace LoRa está funcionando y qué tan bueno es?"*

Herramienta de: configuración de radio · prueba de enlace · monitoreo · medición.
**No** es un administrador LoRaWAN completo (sin OTAA, sin ChirpStack, sin ADR).
El firmware usa **raw LoRa transceiver** (no Modem-E, no stack LoRaWAN).

---

## Estructura del repo

```
lora_app/
  app/               → pantallas Expo Router
  lib/               → motor de métricas, BLE protocol, modelos
  hooks/             → React context de sesión
  components/        → UI components
  android/           → proyecto Android precompilado (expo prebuild)
  firmware/
    lora-tx/         → Rust: nodo transmisor raw LoRa (envía paquetes)
    lora-rx/         → Rust: receptor raw LoRa + servidor BLE (conecta a la app)
```

---

## Hardware

### Pinout LR1121 HF → ESP32 (este setup físico)

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

DIO7/8/9 no conectados. Antena LoRa en LORA_ANT.
Dos conjuntos ESP32+LR1121: uno como `lora-tx`, otro como `lora-rx`.

---

## Firmware (`firmware/`)

### Stack

- Rust + `esp-idf-hal` / `esp-idf-svc`
- LR1121 en **modo transceiver** (no Modem-E): usa el driver C `lr11xx_driver`
  (SWDR001) vía FFI, igual que el gateway del repo principal
- BLE server (solo `lora-rx`): `esp-idf-svc` BLE GATT
- Frecuencia de trabajo: **916.8 MHz, SF7, BW125, CR 4/5** (PoC AU915)

### `firmware/lora-tx` — Nodo transmisor

Responsabilidades:
1. Init LR1121 SPI con el pinout de arriba
2. Configurar radio: 916.8 MHz, SF7, BW125, CR 4/5, TX 14 dBm
3. Loop cada 2 s: transmitir paquete binario de 9 bytes

**Formato de paquete TX (9 bytes, little-endian):**

| Offset | Tipo  | Campo | Descripción |
|--------|-------|-------|-------------|
| 0–1    | u16   | seq   | Número de secuencia (wrapping) |
| 2–3    | i16   | temp  | Temperatura mock × 100 (ej. 2470 = 24.70°C) |
| 4–5    | u16   | hum   | Humedad mock × 100 (ej. 6320 = 63.20%) |
| 6–7    | u16   | bat   | Batería mock en mV (ej. 3910) |
| 8      | u8    | crc8  | CRC-8/MAXIM del bytes 0–7 |

Datos mock: temperatura ciclo triangular 20–28°C, humedad correlacionada,
batería constante 3900 mV. Sin GPIO de sensores.

No tiene BLE. Transmite autónomamente.

### `firmware/lora-rx` — Receptor + servidor BLE

Responsabilidades:
1. Init LR1121 SPI (mismo pinout)
2. Configurar radio en RX continuo: mismos parámetros que `lora-tx`
3. Al recibir paquete: leer RSSI y SNR del LR1121, decodificar payload,
   verificar CRC-8, notificar por BLE
4. Servidor BLE GATT con el perfil definido en `lib/protocol.ts`
5. Aceptar comandos `SET_RADIO_CONFIG` para cambiar parámetros en vuelo

**El `lora-rx` es el ESP32 al que se conecta la app Android por BLE.**

### Protocolo BLE — contrato entre firmware y app

Los UUIDs están definidos en `lib/protocol.ts` (app) y deben coincidir
exactamente con el GATT server del firmware.

```
Service UUID:      0000ff00-0000-1000-8000-00805f9b34fb

CHAR_DEVICE_INFO:  0000ff01-...  R      JSON: { "name": str, "firmware": str }
CHAR_RADIO_CONFIG: 0000ff02-...  R/W    JSON: RadioConfig (ver abajo)
CHAR_RADIO_STATUS: 0000ff03-...  R      JSON: { "success": bool }
CHAR_PACKET_RX:    0000ff04-...  Notify JSON: Packet (ver abajo)
CHAR_COMMAND:      0000ff05-...  W      JSON: { "cmd": str, ...payload }
```

Todos los valores son JSON, base64-encoded sobre el wire BLE.

**Packet (notificado por CHAR_PACKET_RX):**
```json
{ "seq": 103, "rssi": -73.0, "snr": 6.4, "temp": 24.7, "hum": 63.2, "bat": 3.91 }
```
- `rssi` y `snr`: leídos del LR1121 tras recibir el paquete
- `temp`, `hum`, `bat`: decodificados del payload (dividir por 100 / 100 / 1000)

**RadioConfig (R/W en CHAR_RADIO_CONFIG, payload de SET_RADIO_CONFIG):**
```json
{ "freqHz": 916800000, "sf": 7, "bwKhz": 125, "cr": "4/5", "txPowerDbm": 14 }
```

**Nombre BLE del dispositivo:** debe empezar con `"LORA"` (el scan lo filtra así).

### Compilar firmware

```bash
cd firmware/lora-tx   # o lora-rx
cargo build --release
# Flashear:
espflash flash --monitor target/xtensa-esp32-espidf/release/lora-tx
```

Requiere:
- `espup` instalado y `~/.espup/export-esp.sh` sourced
- `espflash` (`cargo install espflash`)
- Target `xtensa-esp32-espidf` (`espup install`)

---

## App Android

### Stack

- Expo ~54 + React Native 0.81 + TypeScript
- `react-native-ble-plx` ^3.5.1 — BLE nativo
- `react-native-svg` — gráficos de señal
- Package manager: **npm** (no pnpm)

### Compilar y distribuir APK

```bash
npm install

# APK debug (requiere JDK 17 + Android SDK)
cd android && ./gradlew assembleDebug
# APK en: android/app/build/outputs/apk/debug/app-debug.apk

# Instalar por USB (dispositivo con depuración USB activada)
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Configurar SDK: crear `android/local.properties` con `sdk.dir=/ruta/al/sdk`.
En Arch Linux: `sudo pacman -S jdk17-openjdk`.

### Arquitectura app

```
lib/models.ts          → Packet, RadioConfig, LinkQuality, SessionStatistics
lib/metrics-engine.ts  → PDR, gap detection por seq number, RSSI/SNR stats
lib/link-quality.ts    → LINK_THRESHOLDS (heurísticos) + evaluateLinkQuality()
lib/protocol.ts        → UUIDs BLE — fuente de verdad, no duplicar
lib/transport.ts       → ITransport · MockTransport · BleTransport

hooks/session-context.tsx → SessionProvider + useSession()

app/(tabs)/index.tsx   → Monitor: link status + stats + gráficos RSSI/SNR
app/(tabs)/config.tsx  → Config: SF/BW/CR/freq/TX + APPLY + ack del ESP32
app/(tabs)/log.tsx     → Log: paquetes con gap detection visual
```

### Mock Mode

`MockTransport` activo por defecto (sin hardware). Genera paquetes cada 2 s
con ~5% de pérdida simulada. Permite desarrollar y testear la UI sin ESP32.

### Capas de separación

- UI no calcula PDR ni calidad — solo consume `useSession()`
- `MetricsEngine` es puro (sin React), testeable independientemente
- Para pasar de mock a BLE real: `switchToBle(new BleTransport(device))`

### Calidad del enlace — umbrales heurísticos

En `lib/link-quality.ts` → `LINK_THRESHOLDS`. Calibrar con mediciones reales.

| Estado     | PDR    | RSSI avg | SNR avg |
|------------|--------|----------|---------|
| EXCELLENT  | ≥ 98%  | ≥ -70    | ≥ 7 dB  |
| GOOD       | ≥ 95%  | ≥ -80    | ≥ 4 dB  |
| ACCEPTABLE | ≥ 85%  | ≥ -90    | ≥ 0 dB  |
| POOR       | > 0 RX | (any)    | (any)   |
| NO LINK    | sin paquetes por > 10 s   |         |

### Permisos Android (ya configurados en app.json)

`BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`,
`ACCESS_FINE_LOCATION` (requerido por Android 12+ para BLE scan).

---

## Próximos pasos previstos

- [ ] Implementar `firmware/lora-tx` (Rust, raw LoRa TX)
- [ ] Implementar `firmware/lora-rx` (Rust, raw LoRa RX + BLE GATT server)
- [ ] Pantalla BLE scan/connect en la app
- [ ] Wiring real del BleTransport con el firmware
- [ ] Tests del MetricsEngine y LinkQualityEvaluator
- [ ] Link Test con duración/intervalo configurable y resumen final
- [ ] README de distribución APK

---

## Convención de commits

```
feat(android): ...   feat(firmware): ...
fix(android): ...    fix(firmware): ...
```
