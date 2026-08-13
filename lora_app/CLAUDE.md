# CLAUDE.md — LoRa Commissioning Tool

Herramienta de puesta en servicio de nodos LoRa, compuesta por:
- **App Android** (Expo + React Native + TypeScript): wizard BLE de comisionamiento
- **Firmware ESP32** (`../lora_firmware/`): dos binarios Rust, uno por rol

La comunicación BLE es el canal de configuración y diagnóstico.
El enlace medido es RF LoRa entre nodo transmisor (`lora-tx`) y gateway (`lora-rx`).

## Objetivo

Guiar a un técnico operario en el proceso de instalar y verificar un nodo LoRa:
configurar el gateway → conectar el nodo → aplicar config de radio → verificar enlace → registrar GPS.

---

## Estructura del repo

```
lora_app/                   ← este directorio (app Android)
  app/
    index.tsx               → redirect automático según CommissioningStep
    _layout.tsx             → providers: Commissioning > Session > NodeSession > Stack
    wizard/
      home.tsx              → pantalla inicial: nuevo nodo / retomar / abandonar
      _layout.tsx           → Stack con las 8 pantallas del wizard
      gateway-setup/
        _layout.tsx         → Tabs: Monitor · Config · Test · Log + FAB "Listo"
        index.tsx           → Monitor: link status, stats, gráficos, diagnóstico C4
        config.tsx          → Config radio gateway: freq/SF/BW/CR/TX + disclaimer sync
        test.tsx            → Link Test con duración configurable y resumen final
        log.tsx             → Log de paquetes raw con gap detection
      gateway-identify.tsx  → Nombre del gateway + GPS + WiFi (SSID/password → BLE → NVS)
      node-connect.tsx      → BLE scan/connect: filtra por nombre "TX", lee nodeType
      node-identify.tsx     → Muestra tipo auto-detectado + campo nombre del nodo
      node-setup/
        _layout.tsx         → Tabs: Config nodo · Enlace
        config.tsx          → Config nodo: copia desde gateway, indicador de sync
        verify.tsx          → Verificar enlace: calidad ACK, control TX, diagnóstico
      gps.tsx               → GPS del nodo: coordenadas o skip
      summary.tsx           → Resumen del comisionamiento (gateway + nodo)

  lib/
    protocol.ts             → UUIDs BLE — fuente de verdad, no duplicar
    models.ts               → Packet, RadioConfig, AckPayload, CommissioningState, LinkQuality
    transport.ts            → ITransport · INodeTransport · Mock* · GatewayBleTransport · NodeBleTransport
    metrics-engine.ts       → PDR, gap detection, RSSI/SNR stats
    link-quality.ts         → LINK_THRESHOLDS + evaluateLinkQuality()

  hooks/
    commissioning-context.tsx  → CommissioningProvider: estado wizard + AsyncStorage
    session-context.tsx        → SessionProvider: gateway BLE session
    node-session-context.tsx   → NodeSessionProvider: node BLE session + TX control + auto-reconexión BLE

  ble/
    ble-manager.tsx            → scan (filtra "LORA*") + connectToDevice + disconnect
    near-devices-screen.tsx    → pantalla legacy de scan/connect para el gateway

  docs/
    analisis-encaje-operario.md → análisis del flujo de comisionamiento desde el operario

  components/
    wizard-progress.tsx     → 6 dots: Gateway · Nodo · Config · Enlace · GPS · Listo
    link-status-badge.tsx   → badge de calidad: EXCELLENT/GOOD/ACCEPTABLE/POOR/NO_LINK
    themed-card.tsx, themed-text.tsx, app-button.tsx, separator.tsx, metric.tsx
    signal-chart.tsx, chart.tsx

lora_firmware/              ← firmware ESP32 (directorio hermano)
  lr1121/                   → driver LR1121 en modo transceiver + ACK encoding
  lora-rx/                  → gateway: RX continuo + BLE GATT + ACK downlink
  lora-tx/                  → nodo: TX loop + BLE GATT + ventana ACK RX
```

---

## Flujo del wizard

```
home  →  gateway-setup (4 tabs)  →  gateway-identify  →  node-connect  →  node-identify  →  node-setup (2 tabs)  →  gps  →  summary
         Monitor/Config/Test/Log     Nombre/GPS/WiFi                        Tipo/Nombre         Config nodo/Enlace
```

**CommissioningStep** (persistido en AsyncStorage `@commissioning_v1`):
`idle → gateway_setup → gateway_identify → node_connect → node_identify → node_config → verify_link → gps → complete`

El `index.tsx` redirige automáticamente al step actual al abrir la app.

---

## Hardware

### Pinout LR1121 HF → ESP32

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
Dos conjuntos ESP32+LR1121: uno como `lora-tx` (nodo), otro como `lora-rx` (gateway).

---

## Firmware (`../lora_firmware/`)

### Stack
- Rust + `esp-idf-hal` / `esp-idf-svc`
- LR1121 en **modo transceiver raw** (no Modem-E, no stack LoRaWAN)
- BLE: `esp32-nimble` en **ambos** binarios
- Frecuencia de trabajo: **916.8 MHz, SF7, BW125, CR 4/5** (PoC AU915)

### `lora-rx` — Gateway (receptor + servidor BLE)

Responsabilidades:
1. RX continuo en 916.8 MHz SF7 BW125 CR4/5
2. Al recibir paquete del nodo:
   - Decodificar payload (9 bytes, CRC-8/MAXIM)
   - Notificar por BLE via `CHAR_PACKET_RX` (Notify)
   - **ACK downlink (C2):** transmitir 7 bytes LoRa de vuelta al nodo con RSSI/SNR del gateway
   - Volver a RX continuo
3. Aceptar comandos vía `CHAR_COMMAND`:
   - `SET_RADIO_CONFIG` — cambia parámetros de radio en vuelo
   - `SET_DEVICE_NAME` — `{ "name": string }` — actualiza nombre BLE + persiste en NVS
   - `SET_WIFI_CREDENTIALS` — `{ "ssid": string, "password": string }` — persiste en NVS y conecta
4. NVS (namespace `lora_rx`): `radio_cfg`, `device_name`, `wifi_ssid`, `wifi_pass`
5. Advertising BLE con el nombre guardado en NVS (default `"LORA-RX-01"`)
6. WiFi + BLE coexistencia habilitada (`CONFIG_ESP_COEX_SW_COEXIST_ENABLE`); auto-conecta al boot si hay credenciales en NVS

### `lora-tx` — Nodo transmisor

Responsabilidades:
1. TX loop cada `interval_ms` ms (default 2000)
2. Por ciclo:
   - Transmitir paquete de 9 bytes con datos mock
   - Escuchar ~400 ms por ACK downlink del gateway
   - Si ACK llega y CRC válido: notificar por `CHAR_ACK_RX` (Notify)
   - Volver a modo TX para siguiente ciclo
3. BLE GATT completo (ver protocolo abajo)
4. Advertising BLE como `"LORA-TX-01"` (el scan filtra por "TX")

**Comandos BLE aceptados por `lora-tx`:**
- `PAUSE_TX` — detiene el loop automático
- `RESUME_TX` — reactiva el loop
- `SEND_ONE` — envía un paquete inmediato (sin importar si está pausado)
- `SET_TX_INTERVAL` — `{ "intervalMs": N }`, rango 500–60000
- `SET_RADIO_CONFIG` — cambia parámetros de radio en vuelo

---

## Protocolo BLE — contrato firmware ↔ app

Los UUIDs están en `lib/protocol.ts` y deben coincidir exactamente con el GATT server.

```
Service UUID:      0000ff00-0000-1000-8000-00805f9b34fb

CHAR_DEVICE_INFO:  0000ff01-...  R       JSON: { name, firmware, role: "gateway"|"node" }
CHAR_RADIO_CONFIG: 0000ff02-...  R/W     JSON: RadioConfig
CHAR_RADIO_STATUS: 0000ff03-...  R       JSON: { success: bool }
CHAR_PACKET_RX:    0000ff04-...  Notify  JSON: Packet          (gateway only)
CHAR_COMMAND:      0000ff05-...  W       JSON: { cmd, ...payload }
CHAR_ACK_RX:       0000ff06-...  Notify  JSON: AckPayload      (node only)
```

**Packet** (notificado por CHAR_PACKET_RX, gateway):
```json
{ "seq": 103, "rssi": -73.0, "snr": 6.4, "temp": 24.7, "hum": 63.2, "bat": 3.91 }
```

**AckPayload** (notificado por CHAR_ACK_RX, nodo):
```json
{ "seqAck": 103, "rssiGw": -73.0, "snrGw": 6.4, "delivered": true }
```
— RSSI/SNR del gateway, medidos cuando recibió el paquete del nodo.
— El nodo lo recibe vía ACK downlink LoRa (7 bytes, CRC-8) y lo expone por BLE.

**ACK downlink LoRa (gateway → nodo, 7 bytes, little-endian):**

| Bytes | Tipo  | Campo      |
|-------|-------|------------|
| 0–1   | u16   | seqAck     |
| 2–3   | i16   | rssiGw dBm |
| 4     | i8    | snrGw dB   |
| 5     | u8    | delivered  |
| 6     | u8    | CRC-8/MAXIM de bytes 0–5 |

**Packet TX del nodo (9 bytes, little-endian):**

| Bytes | Tipo  | Campo       |
|-------|-------|-------------|
| 0–1   | u16   | seq         |
| 2–3   | i16   | temp × 100  |
| 4–5   | u16   | hum × 100   |
| 6–7   | u16   | bat mV      |
| 8     | u8    | CRC-8/MAXIM de bytes 0–7 |

Todos los valores BLE son JSON, **base64-encoded** sobre el wire.

**Nombre BLE del dispositivo:**
- Gateway: empieza con `"LORA"` (el scan de la app filtra así para el gateway)
- Nodo: contiene `"TX"` (el scan de node-connect filtra así)

---

## App Android

### Stack
- Expo ~54 + React Native 0.81 + TypeScript
- `react-native-ble-plx` ^3.5.1 — BLE nativo
- `@react-native-async-storage/async-storage` — persistencia del estado wizard
- `expo-location` — GPS (pantalla gps.tsx)
- `react-native-svg` — gráficos de señal
- Package manager: **npm** (no pnpm)

### Compilar y distribuir APK

```bash
npm install

# APK debug (requiere JDK 17 + Android SDK)
cd android && ./gradlew assembleDebug
# APK en: android/app/build/outputs/apk/debug/app-debug.apk

# Instalar por USB
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Configurar SDK: crear `android/local.properties` con `sdk.dir=/ruta/al/sdk`.

### Providers (en orden de anidado)

```
CommissioningProvider   → estado del wizard, persistido en AsyncStorage
  SessionProvider       → sesión BLE del gateway (ITransport)
    NodeSessionProvider → sesión BLE del nodo (INodeTransport) + TX control + auto-reconexión
      Stack (Expo Router)
```

`NodeSessionProvider` detecta desconexión BLE del nodo vía `device.onDisconnected()`, cae a `MockNodeTransport` temporalmente y reintenta `connectToDevice(deviceId)` cada 3 s hasta reconectar. El estado `reconnecting: boolean` está disponible en `useNodeSession()` para mostrar feedback al usuario.

### Mock Mode

`MockTransport` y `MockNodeTransport` activos por defecto.
`MockTransport`: gateway simulado, paquetes cada 2 s con ~5% pérdida.
`MockNodeTransport`: nodo simulado, ACKs cada `interval_ms` con ~8% pérdida.

Para pasar a BLE real: `connectNode(new NodeBleTransport(device))` desde `node-connect.tsx`.

### Calidad del enlace

`ackLinkQuality(rssiGw, snrGw)` en `verify.tsx` (perspectiva del gateway):

| Estado     | RSSI avg | SNR avg |
|------------|----------|---------|
| EXCELLENT  | ≥ -70    | ≥ 7 dB  |
| GOOD       | ≥ -80    | ≥ 4 dB  |
| ACCEPTABLE | ≥ -90    | ≥ 0 dB  |
| POOR       | (resto)  |         |
| NO_LINK    | sin ACKs |         |

`evaluateLinkQuality()` en `lib/link-quality.ts` (perspectiva del gateway, stats históricas).

### Permisos Android (configurados en app.json)

`BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`,
`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (requeridos por Android 12+ para BLE scan y GPS).

---

## Firmware — compilar

```bash
cd ../lora_firmware/lora-rx   # o lora-tx
cargo build --release
espflash flash --monitor target/xtensa-esp32-espidf/release/lora-rx
```

Requiere:
- `espup` instalado y `~/.espup/export-esp.sh` sourced
- `espflash` (`cargo install espflash`)
- Target `xtensa-esp32-espidf` (`espup install`)

---

## Convención de commits

```
feat(android): ...   feat(firmware): ...
fix(android): ...    fix(firmware): ...
```

---

## Arquitectura del sistema — decisiones de diseño

### Tipos de nodo

- Cada tipo de nodo tiene **firmware dedicado** (no firmware universal). El tipo está implícito en el hardware/drivers compilados.
- El nodo **anuncia su tipo via BLE** a la app Android. El operario no selecciona el tipo manualmente: lo lee del advertisement.
- Tipos contemplados: estación meteorológica (foco de la PoC), humedad de suelo, nodo de silo bolsa.
- Cada nodo físico tiene un **ID único derivado del hardware** (silicon ID del MCU, ej: `esp_efuse_mac_get_default()` en ESP32).

### Commissioning del operario (app Android)

El operario **no toma decisiones técnicas**, solo operativas. Lo que el firmware no puede saber:

| Campo | Nodo | Gateway |
|-------|------|---------|
| Nombre legible | ✓ ("Sensor suelo - Lote Norte") | ✓ ("Gateway Lote Norte") |
| GPS | ✓ | ✓ (ChirpStack lo usa para cobertura y geolocalización) |
| Tipo | autodescripto (BLE) | n/a |
| Contexto/tenant | — (futuro, multi-tenant) | — (futuro, multi-tenant) |

El gateway **no tiene tipo**: es infraestructura genérica que forwardea paquetes, agnóstico de si los datos son reales o mock.

### Credenciales WiFi del gateway

- Las credenciales WiFi se proveen **via BLE desde la app Android** en campo (comando `SET_WIFI_CREDENTIALS`).
- Flujo implementado: gateway recibe SSID/password → guarda en NVS → conecta inmediatamente → auto-conecta en boots siguientes.
- Pendiente: uplink UDP a ChirpStack (el firmware loguea "listo" pero no forwardea aún).
- Feature futura: la app puede escanear redes WiFi cercanas en vivo y mostrarlas al operario.

### División de responsabilidades entre apps

| App | Rol |
|-----|-----|
| **Tauri (escritorio)** | Solo flashear firmware (USB, en taller/oficina) |
| **Android (esta app)** | Todo el commissioning de campo via BLE: WiFi credentials del gateway, nombre, GPS |

El operario va al campo solo con el teléfono. El flashing es un evento único que ocurre en taller, antes de la instalación física.

### Mock vs real (concern de desarrollo, no de producción)

El gateway es completamente ciego a la veracidad de los datos. Los nodos pueden tener builds de desarrollo (datos mockeados) y builds de producción (sensores reales): eso es un concern del firmware y del proceso de flashing, no de la app Android ni del gateway.

---

## Estado del commissioning

El flujo está completo con identificación de gateway y nodo:

- **gateway-identify.tsx**: nombre (→ BLE `SET_DEVICE_NAME`), GPS (expo-location), WiFi (→ BLE `SET_WIFI_CREDENTIALS`)
- **node-identify.tsx**: tipo auto-detectado desde `CHAR_DEVICE_INFO`, campo nombre libre
- **gps.tsx**: GPS del nodo (ya existía)
- **summary.tsx**: muestra gateway (nombre, radio, WiFi, GPS) y nodo (tipo, radio, enlace, GPS)

### Pendiente

- **ChirpStack forwarder**: cuando WiFi está conectado, el firmware loguea "listo para forwardear" pero no implementa el uplink UDP a ChirpStack aún.
