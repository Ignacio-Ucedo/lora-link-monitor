# Estación Meteorológica — Plan de Desarrollo

> **Objetivo**: App móvil de usuario final que se conecta vía BLE a un ESP32 y muestra datos
> meteorológicos en tiempo real. Proyecto independiente de `lora_app`.

---

## Estado general

| Componente | Estado |
|---|---|
| Firmware ESP32 | ⬜ Pendiente (adaptar Serial → BLE) |
| App scaffold | ⬜ Pendiente |
| BLE connection flow | ⬜ Pendiente |
| Dashboard screen | ⬜ Pendiente |
| Pulido visual (end-user) | ⬜ Pendiente |

---

## Arquitectura

```
ESP32 (DHT22 + Anemómetro)
  └─ BLE GATT Server
       └─ Service "WeatherStation"
            └─ Characteristic "weather_data" (Notify, cada 2 s)
                  Payload JSON: {"t":25.3,"h":60.2,"w":12.5}

App React Native (Expo)
  └─ BLE scan → connect → subscribe
       └─ Dashboard
            ├─ Temperatura  (real)
            ├─ Humedad      (real)
            ├─ Viento       (real, km/h)
            ├─ Dirección    (MOCK — fijo o rotación lenta)
            └─ Lluvia       (MOCK — 0 mm)
```

---

## Protocolo BLE

| Campo | Valor |
|---|---|
| Nombre del dispositivo | `WeatherStation` |
| Service UUID | `181A` (Environmental Sensing — estándar GATT) |
| Characteristic UUID | `2A6E` ... **no**, usaremos UUIDs custom para simplificar |

### UUIDs custom

```
Service:        "12340000-1234-1234-1234-123456789abc"
Characteristic: "12340001-1234-1234-1234-123456789abc"  ← weather_data (Notify)
```

### Payload

JSON compacto enviado cada 2 segundos como string UTF-8:

```json
{"t":25.3,"h":60.2,"w":12.5}
```

| Campo | Descripción | Unidad |
|---|---|---|
| `t` | Temperatura | °C |
| `h` | Humedad relativa | % |
| `w` | Velocidad del viento | km/h |

> El firmware descarta la lectura si DHT22 falla (`isnan`) y en ese caso no notifica
> (o envía `{"t":null,"h":null,"w":12.5}`).

---

## Fase 1 — Firmware ESP32

**Ubicación**: `weather_firmware/` (raíz del repo, hermano de `lora_firmware/`)

### Dependencias Arduino

- `DHT sensor library` (Adafruit)
- `ArduinoBLE` **o** `NimBLE-Arduino` (preferir NimBLE — más ligero en ESP32)

### Tareas

- [ ] **1.1** Crear `weather_firmware/src/main.cpp` y `weather_firmware/platformio.ini`
- [ ] **1.2** Inicializar NimBLE con nombre `WeatherStation` y los UUIDs definidos arriba
- [ ] **1.3** Mantener la lógica de lectura del anemómetro (interrupt + debounce 5 ms)
- [ ] **1.4** Mantener la lógica de lectura del DHT22 (cada 2 s)
- [ ] **1.5** Construir JSON y llamar `characteristic.notify()` cada 2 s
- [ ] **1.6** Agregar indicador LED (onboard) parpadeando cuando hay cliente conectado
- [ ] **1.7** Probar con app nRF Connect antes de tocar la app propia

### Esquema del sketch (referencia para implementación)

```cpp
#include <NimBLEDevice.h>
#include <DHT.h>

#define SERVICE_UUID        "12340000-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "12340001-1234-1234-1234-123456789abc"

// ... (mismo setup de anemómetro e interrupt que el sketch actual)

NimBLECharacteristic* pCharacteristic;

void setup() {
  // init DHT + interrupt (igual que ahora)
  NimBLEDevice::init("WeatherStation");
  NimBLEServer* pServer = NimBLEDevice::createServer();
  NimBLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    NIMBLE_PROPERTY::NOTIFY
  );
  pService->start();
  NimBLEDevice::startAdvertising();
}

void loop() {
  if (millis() - tiempoAnterior >= INTERVALO_MS) {
    // ... leer sensores igual que ahora ...
    char payload[64];
    snprintf(payload, sizeof(payload), "{\"t\":%.1f,\"h\":%.1f,\"w\":%.2f}",
             temperatura, humedad, velocidadViento);
    pCharacteristic->setValue(payload);
    pCharacteristic->notify();
    tiempoAnterior = millis();
  }
}
```

---

## Fase 2 — App móvil

**Ubicación**: `weather_app/` (raíz del repo, hermano de `lora_app/`)

**Stack**: Expo + React Native + TypeScript + `react-native-ble-plx` (ya conocida del proyecto)

### Estructura de carpetas objetivo

```
lora/                          ← raíz del repo
├── lora_app/                  ← intacto (app LoRa)
├── lora_firmware/             ← intacto (Rust + ESP-IDF para LoRa)
├── weather_app/               ← nueva app móvil
│   ├── app/
│   │   ├── _layout.tsx        ← root layout (Stack)
│   │   ├── index.tsx          ← pantalla scan/connect
│   │   └── dashboard.tsx      ← pantalla principal de datos
│   ├── ble/
│   │   └── weather-ble.ts     ← lógica BLE (scan, connect, subscribe)
│   ├── components/
│   │   ├── WeatherCard.tsx    ← tarjeta genérica de métrica
│   │   ├── WindGauge.tsx      ← gauge animado para viento
│   │   └── ConnectionBanner.tsx
│   ├── constants/
│   │   └── ble.ts             ← UUIDs
│   ├── hooks/
│   │   └── useWeatherBLE.ts   ← hook {data, status, connect, disconnect}
│   └── app.json / package.json / tsconfig.json / ...
└── weather_firmware/          ← nuevo firmware Arduino/PlatformIO
    ├── src/
    │   └── main.cpp           ← sketch (DHT22 + anemómetro + BLE)
    └── platformio.ini
```

### Tareas

- [ ] **2.1** Crear app Expo: `npx create-expo-app weather_app --template blank-typescript`
- [ ] **2.2** Instalar deps: `react-native-ble-plx`, `expo-dev-client`, `react-native-svg`, `react-native-reanimated`
- [ ] **2.3** Configurar permisos BLE en `app.json` (android: BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION)
- [ ] **2.4** Implementar `constants/ble.ts` con UUIDs
- [ ] **2.5** Implementar `ble/weather-ble.ts` — scan por nombre `WeatherStation`, connect, subscribe notify
- [ ] **2.6** Implementar `hooks/useWeatherBLE.ts` — state machine: `idle → scanning → connecting → connected → error`
- [ ] **2.7** Pantalla `index.tsx` — botón "Conectar", spinner durante scan/connect, feedback de error
- [ ] **2.8** Pantalla `dashboard.tsx` — 5 cards (temp, humedad, viento, dirección mock, lluvia mock)
- [ ] **2.9** Componente `WeatherCard.tsx` — icono + valor + unidad + label
- [ ] **2.10** Componente `WindGauge.tsx` — aguja animada con Reanimated (opcional, cosmético)
- [ ] **2.11** Mock de dirección de viento: rotación aleatoria suave cada 10 s
- [ ] **2.12** Mock de lluvia: siempre 0 mm con label "Sin datos"
- [ ] **2.13** Generar APK debug y probar en dispositivo físico

### UX / Diseño

- Tema oscuro (fondo `#0D1117`, cards `#161B22`)
- Paleta de acento: celeste `#58A6FF` / verde `#3FB950`
- Fuente grande para los valores (≥ 36 sp), label pequeño debajo
- Indicador de conexión en el header (punto verde/rojo + "Conectado" / "Sin conexión")
- Pantalla de scan muestra animación de búsqueda; si pasan 10 s sin encontrar el dispositivo muestra error con botón "Reintentar"

---

## Fase 3 — Integración y pulido

- [ ] **3.1** Test completo: firmware → BLE → app mostrando datos reales
- [ ] **3.2** Manejo de desconexión inesperada (auto-reconectar o volver a pantalla de scan)
- [ ] **3.3** Historial mínimo: gráfico de línea de temperatura/humedad últimos 30 puntos (optional)
- [ ] **3.4** Icono y splash screen de la app
- [ ] **3.5** Generar APK release firmado (si se necesita distribuir)

---

## Decisiones tomadas

| Decisión | Motivo |
|---|---|
| JSON en una sola characteristic | Más simple que 3 characteristics individuales; fácil de extender |
| NimBLE en vez de ArduinoBLE | Menor RAM, mejor para ESP32, activamente mantenida |
| Expo + ble-plx | Misma stack que lora_app; reutilizar conocimiento y patrones existentes |
| App separada (no módulo de lora_app) | Producto diferente, sin romper lo existente |
| Dirección/lluvia mockeadas | Hardware aún no conectado; UI completa desde el inicio |

---

## Notas de sesión

<!-- Agregar aquí notas relevantes de cada sesión de trabajo -->

### 2026-08-26
- Firmware actual: solo Serial, sin BLE. DHT22 en pin 21, anemómetro en pin 26.
- Factor de conversión: `velocidad_km_h = (pulsos / intervalo_s) * 2.4`
- Debounce hardware en firmware: 5000 µs entre pulsos válidos.
- Decisión: construir app nueva desde cero, `lora_app` intacta.

---

## Referencias rápidas

- **Rediseño UX/UI (propuesta)**: [`weather_app/docs/UX_REDESIGN.md`](weather_app/docs/UX_REDESIGN.md)
- Sketch base actual: en el mensaje de arranque del proyecto (pin 21 = DHT22, pin 26 = anemómetro)
- BLE manager de lora_app: `lora_app/ble/ble-manager.tsx` (referencia de patrones)
- NimBLE docs: https://h2zero.github.io/NimBLE-Arduino/
- react-native-ble-plx: https://dotintent.github.io/react-native-ble-plx/
