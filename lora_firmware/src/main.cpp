#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLECharacteristic *telemetryChar;

float rain = 24.7;
float battery = 3.91;

void setup() {

  BLEDevice::init("LORA-GW-01");

  BLEServer *server = BLEDevice::createServer();

  BLEService *service =
      server->createService("19b10000-e8f2-537e-4f6c-d104768a1214");

  telemetryChar = service->createCharacteristic(
      "19b10001-e8f2-537e-4f6c-d104768a1214",
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_NOTIFY
  );

  telemetryChar->addDescriptor(new BLE2902());

  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->start();
}

void loop() {

  rain += random(0,3) * 0.1;
  battery -= 0.0005;

  String payload = "{";
  payload += "\"node\":1,";
  payload += "\"rain\":" + String(rain,1) + ",";
  payload += "\"battery\":" + String(battery,2) + ",";
  payload += "\"rssi\":-78";
  payload += "}";

  telemetryChar->setValue(payload.c_str());
  telemetryChar->notify();

  delay(5000);
}