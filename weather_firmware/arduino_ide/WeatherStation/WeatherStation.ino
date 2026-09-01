/*
  ESTACIÓN METEOROLÓGICA ESP32 + BLE
  DHT22 + Anemómetro + Veleta

  Pines (NO modificados):
    DHT22      -> GPIO21
    Anemómetro -> GPIO26
    Veleta     -> GPIO4
    LED ESP32  -> GPIO2

  Librerías (instalar desde Library Manager):
    - NimBLE-Arduino (h2zero)
    - DHT sensor library (Adafruit)
    - Adafruit Unified Sensor

  Board: "ESP32 Dev Module"  (Tools → Board → esp32 → ESP32 Dev Module)
*/

#include <NimBLEDevice.h>
#include <DHT.h>
#include "esp_timer.h"

// ---------------- PINES ----------------
#define PIN_DHT        21
#define PIN_ANEMO      26
#define PIN_VELETA     4
#define PIN_LED        2

#define DHT_TYPE DHT22

// ---------------- BLE ----------------
#define SERVICE_UUID        "12340000-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "12340001-1234-1234-1234-123456789abc"

// ---------------- TIEMPOS ----------------
#define INTERVALO_MS 2000UL
#define DEBOUNCE_US  5000UL
#define BLINK_MS      200UL

// ---------------- OBJETOS ----------------
DHT dht(PIN_DHT, DHT_TYPE);
NimBLECharacteristic *pCharacteristic = nullptr;

// ---------------- VARIABLES ----------------
volatile uint32_t pulsos = 0;
volatile uint64_t ultimoPulso_us = 0;

bool clienteConectado = false;

uint32_t tiempoAnterior = 0;
uint32_t ultimoBlink = 0;
bool ledState = false;

// ---------------------------------------------------
// Conversión analógica de la veleta a dirección
// ---------------------------------------------------
const char *leerDireccionViento(int valor)
{
  if (valor < 150)   return "N";
  if (valor < 350)   return "NE";
  if (valor < 550)   return "E";
  if (valor < 800)   return "SE";
  if (valor < 1100)  return "S";
  if (valor < 1500)  return "SO";
  if (valor < 2000)  return "O";
  if (valor < 2600)  return "NO";
  return "N";
}

// ---------------------------------------------------
// Interrupción del anemómetro
// ---------------------------------------------------
void IRAM_ATTR onPulsoAnemo()
{
  uint64_t ahora = esp_timer_get_time();
  if ((ahora - ultimoPulso_us) >= DEBOUNCE_US)
  {
    pulsos++;
    ultimoPulso_us = ahora;
  }
}

// ---------------------------------------------------
// Callbacks BLE
// ---------------------------------------------------
class ServerCallbacks : public NimBLEServerCallbacks
{
  void onConnect(NimBLEServer *server) override
  {
    clienteConectado = true;
    Serial.println("[BLE] Cliente conectado");
  }

  void onDisconnect(NimBLEServer *server) override
  {
    clienteConectado = false;
    digitalWrite(PIN_LED, LOW);
    Serial.println("[BLE] Cliente desconectado");
    NimBLEDevice::startAdvertising();
  }
};

// ---------------------------------------------------
// SETUP
// ---------------------------------------------------
void setup()
{
  Serial.begin(115200);

  dht.begin();

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  pinMode(PIN_ANEMO, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ANEMO), onPulsoAnemo, FALLING);

  NimBLEDevice::init("WeatherStation");

  NimBLEServer *pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  NimBLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      NIMBLE_PROPERTY::READ |
      NIMBLE_PROPERTY::NOTIFY);

  pService->start();

  // Agregar el service UUID al advertising para que la app pueda filtrar por él
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  Serial.println("[BLE] WeatherStation lista, advertising...");

  tiempoAnterior = millis();
}

// ---------------------------------------------------
// LOOP
// ---------------------------------------------------
void loop()
{
  uint32_t ahora = millis();

  if (clienteConectado && ahora - ultimoBlink >= BLINK_MS)
  {
    ultimoBlink = ahora;
    ledState = !ledState;
    digitalWrite(PIN_LED, ledState);
  }

  if (ahora - tiempoAnterior >= INTERVALO_MS)
  {
    uint32_t intervalo = ahora - tiempoAnterior;
    tiempoAnterior = ahora;

    noInterrupts();
    uint32_t p = pulsos;
    pulsos = 0;
    interrupts();

    float tiempoSeg = intervalo / 1000.0f;
    float velocidad = (p / tiempoSeg) * 2.4f;

    float temperatura = dht.readTemperature();
    float humedad = dht.readHumidity();
    const char *direccion = leerDireccionViento(analogRead(PIN_VELETA));

    char payload[100];
    if (isnan(temperatura) || isnan(humedad))
    {
      snprintf(payload, sizeof(payload),
               "{\"t\":null,\"h\":null,\"w\":%.2f,\"d\":\"%s\"}",
               velocidad, direccion);
    }
    else
    {
      snprintf(payload, sizeof(payload),
               "{\"t\":%.1f,\"h\":%.1f,\"w\":%.2f,\"d\":\"%s\"}",
               temperatura, humedad, velocidad, direccion);
    }

    Serial.print("Temp: "); Serial.print(temperatura); Serial.println(" °C");
    Serial.print("Humedad: "); Serial.print(humedad); Serial.println(" %");
    Serial.print("Velocidad: "); Serial.print(velocidad); Serial.println(" km/h");
    Serial.print("Veleta ADC: "); Serial.print(analogRead(PIN_VELETA));
    Serial.print(" -> "); Serial.println(direccion);
    Serial.println(payload);

    if (pCharacteristic != nullptr)
    {
      pCharacteristic->setValue(payload);
      pCharacteristic->notify();
    }
  }
}
