// BLE UUIDs — single source of truth. Never hardcode elsewhere.
// CHAR_DEVICE_INFO includes { name, firmware, role: "gateway" | "node" }
// CHAR_ACK_RX is node-only: gateway sends LoRa ACK back after each RX;
//   node receives it, parses it, and exposes here for the commissioning app.

export const BLE_PROTOCOL = {
  SERVICE_UUID:      "0000ff00-0000-1000-8000-00805f9b34fb",
  CHAR_DEVICE_INFO:  "0000ff01-0000-1000-8000-00805f9b34fb", // R  — { name, firmware, role }
  CHAR_RADIO_CONFIG: "0000ff02-0000-1000-8000-00805f9b34fb", // R/W
  CHAR_RADIO_STATUS: "0000ff03-0000-1000-8000-00805f9b34fb", // R  — { success: boolean }
  CHAR_PACKET_RX:    "0000ff04-0000-1000-8000-00805f9b34fb", // Notify (gateway only)
  CHAR_COMMAND:      "0000ff05-0000-1000-8000-00805f9b34fb", // W
  CHAR_ACK_RX:       "0000ff06-0000-1000-8000-00805f9b34fb", // Notify (node only)
  // Wire format: { seqAck, rssiGw, snrGw, delivered }
} as const;

export type DeviceRole = "gateway" | "node";

export type BleCommand =
  | "GET_DEVICE_INFO"
  | "GET_RADIO_CONFIG"
  | "SET_RADIO_CONFIG"
  | "GET_RADIO_STATUS"
  | "START_TEST"
  | "STOP_TEST"
  | "RESET_SESSION"
  // Node-only TX control commands (require C1 firmware):
  | "PAUSE_TX"             // stop automatic TX loop
  | "RESUME_TX"            // restart automatic TX loop
  | "SEND_ONE"             // trigger one immediate TX
  | "SET_TX_INTERVAL"      // payload: { intervalMs: number }
  // Gateway identity / provisioning commands:
  | "SET_DEVICE_NAME"      // payload: { name: string }
  | "SET_WIFI_CREDENTIALS"; // payload: { ssid: string, password: string }
