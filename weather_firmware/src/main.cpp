#include <NimBLEDevice.h>
#include <DHT.h>

#define PIN_DHT        21
#define PIN_ANEMO      26
#define PIN_VELETA     4
#define PIN_LED        2
#define DHT_TYPE       DHT22

#define SERVICE_UUID        "12340000-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "12340001-1234-1234-1234-123456789abc"

#define INTERVALO_MS  2000UL
#define DEBOUNCE_US   5000UL
#define BLINK_MS      200UL

DHT dht(PIN_DHT, DHT_TYPE);
NimBLECharacteristic* pCharacteristic = nullptr;

volatile uint32_t pulsos = 0;
volatile uint64_t ultimoPulso_us = 0;
bool clienteConectado = false;

uint32_t tiempoAnterior = 0;
uint32_t ultimoBlink = 0;
bool ledState = false;

static const char* leerDireccionViento(int v) {
    if (v < 150)  return "N";
    if (v < 350)  return "NE";
    if (v < 550)  return "E";
    if (v < 800)  return "SE";
    if (v < 1100) return "S";
    if (v < 1500) return "SO";
    if (v < 2000) return "O";
    if (v < 2600) return "NO";
    return "N";
}

void IRAM_ATTR onPulsoAnemo() {
    uint64_t ahora = esp_timer_get_time();
    if (ahora - ultimoPulso_us >= DEBOUNCE_US) {
        pulsos++;
        ultimoPulso_us = ahora;
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

void setup() {
    Serial.begin(115200);
    pinMode(PIN_LED, OUTPUT);
    digitalWrite(PIN_LED, LOW);

    dht.begin();

    analogReadResolution(12);

    pinMode(PIN_ANEMO, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_ANEMO), onPulsoAnemo, FALLING);

    NimBLEDevice::init("WeatherStation");
    NimBLEServer* pServer = NimBLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    NimBLEService* pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        NIMBLE_PROPERTY::NOTIFY
    );
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

    // LED parpadea solo cuando hay cliente conectado
    if (clienteConectado && ahora - ultimoBlink >= BLINK_MS) {
        ledState = !ledState;
        digitalWrite(PIN_LED, ledState);
        ultimoBlink = ahora;
    }

    if (ahora - tiempoAnterior >= INTERVALO_MS) {
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
        const char* direccion = leerDireccionViento(analogRead(PIN_VELETA));

        char payload[80];
        if (isnan(temperatura) || isnan(humedad)) {
            snprintf(payload, sizeof(payload),
                     "{\"t\":null,\"h\":null,\"w\":%.2f,\"d\":\"%s\"}",
                     velocidadViento, direccion);
        } else {
            snprintf(payload, sizeof(payload),
                     "{\"t\":%.1f,\"h\":%.1f,\"w\":%.2f,\"d\":\"%s\"}",
                     temperatura, humedad, velocidadViento, direccion);
        }

        Serial.println(payload);

        pCharacteristic->setValue(payload);
        pCharacteristic->notify();
    }
}
