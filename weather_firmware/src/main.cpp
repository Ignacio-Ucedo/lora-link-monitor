#include <NimBLEDevice.h>
#include <DHT.h>
#include <Preferences.h>
#include <ArduinoJson.h>

#define PIN_DHT        21
#define PIN_ANEMO      26
#define PIN_VELETA     34
#define PIN_PLUVIO     25
#define PIN_LED        2
#define DHT_TYPE       DHT22

#define SERVICE_UUID           "12340000-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID    "12340001-1234-1234-1234-123456789abc"
#define CONFIG_CHARACTERISTIC_UUID "12340002-1234-1234-1234-123456789abc"

#define INTERVALO_MS_DEFAULT  2000UL
#define INTERVALO_MS_MIN      2000UL
#define INTERVALO_MS_MAX      3600000UL
#define DEBOUNCE_US   5000UL
#define BLINK_MS      200UL

// Pluviómetro de balancín (reed): cada vuelco de cangilón = un pulso. Los vuelcos
// son lentos y el contacto rebota, así que el debounce es más generoso que el del
// anemómetro. Calibración del balancín: cada vuelco = 0,20 mm (5 vuelcos = 1 mm de
// lluvia). Durante las pruebas lo simulamos con un pulsador para verlo en la app.
#define DEBOUNCE_PLUVIO_US  50000UL
#define MM_POR_VUELCO       0.2f

DHT dht(PIN_DHT, DHT_TYPE);
NimBLECharacteristic* pCharacteristic = nullptr;
NimBLECharacteristic* pConfigChar = nullptr;
Preferences prefs;

// Config editable desde la app y persistida en NVS (sobrevive reinicios):
//   - intervaloMs: cada cuánto se muestrea/notifica (2 s … 1 h)
//   - veletaRawNorte: raw del ADC con la veleta apuntando al Norte (calibración)
uint32_t intervaloMs = INTERVALO_MS_DEFAULT;
int veletaRawNorte = 0;
volatile bool forzarEnvio = false;   // envío inmediato tras un cambio de config

volatile uint32_t pulsos = 0;
volatile uint64_t ultimoPulso_us = 0;

// Lluvia: acumulador de vuelcos desde el arranque. No se resetea por intervalo
// (a diferencia del anemómetro, que mide una tasa): la lluvia es acumulada.
volatile uint32_t vuelcosLluvia = 0;
volatile uint64_t ultimoVuelco_us = 0;

bool clienteConectado = false;

uint32_t tiempoAnterior = 0;
uint32_t ultimoBlink = 0;
bool ledState = false;

// Veleta: potenciómetro continuo leído directo por ADC (0..4095 → 0..360°).
// La placa intermedia con el PIC se descartó: su salida estaba muerta (clavada
// en alto, cero actividad). Leemos el cursor del pote directo.
//
// Calibración del Norte: se hace desde la app. El usuario apunta la veleta al
// Norte y toca "Calibrar norte"; el firmware captura el raw actual del ADC en
// veletaRawNorte y lo persiste. Si al girar a la derecha las direcciones van al
// revés (N→NO en vez de N→NE), poné VELETA_INVERTIR en true.
#define VELETA_INVERTIR    false    // true si E/O quedan cruzados

static const char* leerDireccionViento(int raw) {
    long ang   = (long)raw * 360 / 4096;                 // ángulo crudo 0..359
    long norte = (long)veletaRawNorte * 360 / 4096;
    long rel   = ((ang - norte) % 360 + 360) % 360;      // 0..359 relativo al N
    if (VELETA_INVERTIR) rel = (360 - rel) % 360;

    static const char* rosa[16] = {
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"
    };
    int idx = (int)(((rel * 4 + 45) / 90) % 16);         // sectores de 22.5°, centrados
    return rosa[idx];
}

void IRAM_ATTR onPulsoAnemo() {
    uint64_t ahora = esp_timer_get_time();
    if (ahora - ultimoPulso_us >= DEBOUNCE_US) {
        pulsos++;
        ultimoPulso_us = ahora;
    }
}

void IRAM_ATTR onPulsoPluvio() {
    uint64_t ahora = esp_timer_get_time();
    if (ahora - ultimoVuelco_us >= DEBOUNCE_PLUVIO_US) {
        vuelcosLluvia++;
        ultimoVuelco_us = ahora;
    }
}

class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer*) override {
        clienteConectado = true;
        Serial.println("[BLE] Cliente conectado");
    }
    void onDisconnect(NimBLEServer*) override {
        clienteConectado = false;
        digitalWrite(PIN_LED, LOW);
        NimBLEDevice::startAdvertising();
        Serial.println("[BLE] Cliente desconectado — re-advertising");
    }
};

// Refleja la config actual en la característica de config (la app la lee al
// conectar y tras cada cambio para confirmar el estado).
void publicarConfig() {
    if (!pConfigChar) return;
    char cfg[64];
    snprintf(cfg, sizeof(cfg), "{\"interval_ms\":%u,\"north\":%d}",
             intervaloMs, veletaRawNorte);
    pConfigChar->setValue((uint8_t*)cfg, strlen(cfg));
}

// La app escribe comandos JSON en la característica de config:
//   {"cmd":"set_interval","ms":5000}   → tasa de muestreo
//   {"cmd":"set_north"}                → fija el Norte al raw actual de la veleta
class ConfigCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c) override {
        std::string v = c->getValue();
        JsonDocument doc;
        if (deserializeJson(doc, v)) return;   // JSON inválido → ignorar

        const char* cmd = doc["cmd"] | "";
        if (strcmp(cmd, "set_interval") == 0) {
            uint32_t ms = doc["ms"] | intervaloMs;
            if (ms < INTERVALO_MS_MIN) ms = INTERVALO_MS_MIN;
            if (ms > INTERVALO_MS_MAX) ms = INTERVALO_MS_MAX;
            intervaloMs = ms;
            prefs.putUInt("interval", intervaloMs);
            forzarEnvio = true;
            Serial.printf("[CFG] intervalo = %u ms\n", intervaloMs);
        } else if (strcmp(cmd, "set_north") == 0) {
            veletaRawNorte = analogRead(PIN_VELETA);
            prefs.putInt("north", veletaRawNorte);
            forzarEnvio = true;
            Serial.printf("[CFG] norte = raw %d\n", veletaRawNorte);
        }
        publicarConfig();
    }
};

void setup() {
    Serial.begin(115200);
    pinMode(PIN_LED, OUTPUT);
    digitalWrite(PIN_LED, LOW);

    dht.begin();

    analogReadResolution(12);

    // Config persistida (intervalo de muestreo y Norte de la veleta).
    prefs.begin("weather", false);
    intervaloMs    = prefs.getUInt("interval", INTERVALO_MS_DEFAULT);
    veletaRawNorte = prefs.getInt("north", 0);
    Serial.printf("[CFG] cargado: intervalo=%u ms, norte=raw %d\n",
                  intervaloMs, veletaRawNorte);

    pinMode(PIN_ANEMO, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_ANEMO), onPulsoAnemo, FALLING);

    pinMode(PIN_PLUVIO, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_PLUVIO), onPulsoPluvio, FALLING);

    NimBLEDevice::init("WeatherStation");
    NimBLEServer* pServer = NimBLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    NimBLEService* pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        NIMBLE_PROPERTY::NOTIFY
    );

    // Característica de config: la app la lee (estado actual) y le escribe comandos.
    pConfigChar = pService->createCharacteristic(
        CONFIG_CHARACTERISTIC_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE
    );
    pConfigChar->setCallbacks(new ConfigCallbacks());
    publicarConfig();

    pService->start();

    // La app escanea filtrando por Service UUID, así que hay que incluirlo en el
    // paquete de advertising (NimBLE no lo agrega solo). Sin esto el scan por UUID
    // no hace match y la app nunca encuentra la estación.
    NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    NimBLEDevice::startAdvertising();

    tiempoAnterior = millis();
    Serial.println("[BLE] WeatherStation listo, advertising...");
}

void loop() {
    uint32_t ahora = millis();

    // TEMPORAL (calibración veleta): muestreo rápido del raw para ver el barrido
    // completo y la zona muerta. Sacar cuando terminemos de calibrar.
    static uint32_t ultimaMuestraCal = 0;
    if (ahora - ultimaMuestraCal >= 150) {
        ultimaMuestraCal = ahora;
        Serial.printf("R %d\n", analogRead(PIN_VELETA));
    }

    // LED parpadea solo cuando hay cliente conectado
    if (clienteConectado && ahora - ultimoBlink >= BLINK_MS) {
        ledState = !ledState;
        digitalWrite(PIN_LED, ledState);
        ultimoBlink = ahora;
    }

    if (forzarEnvio || (ahora - tiempoAnterior >= intervaloMs)) {
        forzarEnvio = false;
        uint32_t intervalo_ms = ahora - tiempoAnterior;
        tiempoAnterior = ahora;

        noInterrupts();
        uint32_t p = pulsos;
        pulsos = 0;
        interrupts();

        float intervalo_s = intervalo_ms / 1000.0f;
        float velocidadViento = (p / intervalo_s) * 2.4f;

        float temperatura = dht.readTemperature();
        float humedad = dht.readHumidity();

        int veletaRaw = analogRead(PIN_VELETA);
        const char* direccion = leerDireccionViento(veletaRaw);

        // Lectura atómica en ESP32 (32 bits); la lluvia es acumulada, no se resetea.
        float lluviaMm = vuelcosLluvia * MM_POR_VUELCO;

        // DEBUG veleta (temporal): caracteriza la señal en GPIO34. Nivel
        // analógico + medición de pulso. Si es analógica, hi/lo dan 0 (timeout);
        // si es PWM, hi/lo son estables y el duty cambia al girar; si es serie,
        // dan valores erráticos. Sacar una vez calibrado el mapeo.
        unsigned long vHi = pulseIn(PIN_VELETA, HIGH, 30000);
        unsigned long vLo = pulseIn(PIN_VELETA, LOW, 30000);
        Serial.printf("[VELETA] raw=%d (%.2fV) dir=%s | pulso hi=%luus lo=%luus\n",
                      veletaRaw, veletaRaw * 3.3 / 4095.0, direccion, vHi, vLo);

        char payload[96];
        if (isnan(temperatura) || isnan(humedad)) {
            snprintf(payload, sizeof(payload),
                     "{\"t\":null,\"h\":null,\"w\":%.2f,\"d\":\"%s\",\"r\":%.1f}",
                     velocidadViento, direccion, lluviaMm);
        } else {
            snprintf(payload, sizeof(payload),
                     "{\"t\":%.1f,\"h\":%.1f,\"w\":%.2f,\"d\":\"%s\",\"r\":%.1f}",
                     temperatura, humedad, velocidadViento, direccion, lluviaMm);
        }

        Serial.println(payload);

        // Enviar SOLO los bytes del JSON, no todo el buffer. setValue(char[80])
        // toma el tamaño del arreglo (80) y manda el JSON + bytes basura sin
        // inicializar, rompiendo el JSON.parse del lado de la app.
        pCharacteristic->setValue((uint8_t*)payload, strlen(payload));
        pCharacteristic->notify();
    }
}
