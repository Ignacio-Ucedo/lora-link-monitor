// Provisional BLE UUIDs for LoRa Link Monitor PoC.
// MUST be updated to match the real ESP32 firmware GATT profile.
// All UUIDs are centralised here — never hardcode them elsewhere.

export const BLE_PROTOCOL = {
  SERVICE_UUID:      "0000ff00-0000-1000-8000-00805f9b34fb",
  CHAR_DEVICE_INFO:  "0000ff01-0000-1000-8000-00805f9b34fb", // R
  CHAR_RADIO_CONFIG: "0000ff02-0000-1000-8000-00805f9b34fb", // R/W
  CHAR_RADIO_STATUS: "0000ff03-0000-1000-8000-00805f9b34fb", // R
  CHAR_PACKET_RX:    "0000ff04-0000-1000-8000-00805f9b34fb", // Notify
  CHAR_COMMAND:      "0000ff05-0000-1000-8000-00805f9b34fb", // W

  // Wire format (JSON over BLE, base64 encoded):
  //   PACKET_RX notify : { seq, rssi, snr, temp, hum, bat }
  //   COMMAND write    : { cmd: BleCommand, ...payload }
  //   RADIO_STATUS read: { success: boolean, ...detail }
} as const;

export type BleCommand =
  | "GET_DEVICE_INFO"
  | "GET_RADIO_CONFIG"
  | "SET_RADIO_CONFIG"
  | "GET_RADIO_STATUS"
  | "START_TEST"
  | "STOP_TEST"
  | "RESET_SESSION";
