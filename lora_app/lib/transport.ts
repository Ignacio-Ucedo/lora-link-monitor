import { Packet, RadioConfig } from "./models";
import { BLE_PROTOCOL } from "./protocol";

export type PacketCallback = (p: Packet) => void;
export type ConfigAckCallback = (success: boolean) => void;

export interface ITransport {
  readonly id: string;
  start(onPacket: PacketCallback): void;
  stop(): void;
  applyRadioConfig(config: RadioConfig, onAck: ConfigAckCallback): void;
  getDeviceInfo(): Promise<{ name: string; firmware: string }>;
}

// ─── Mock Transport ───────────────────────────────────────────────────────────

const MOCK_RSSI_BASE = -70;
const MOCK_SNR_BASE = 7;
const MOCK_INTERVAL_MS = 2000;
const MOCK_LOSS_PROB = 0.05;

export class MockTransport implements ITransport {
  readonly id = "mock";
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 1;
  private bat = 4.1;

  start(onPacket: PacketCallback) {
    this.stop();
    this.seq = 1;
    this.bat = 4.1;

    this.timer = setInterval(() => {
      const seq = this.seq++;
      if (Math.random() < MOCK_LOSS_PROB) return;

      onPacket({
        seq,
        timestamp: Date.now(),
        rssi: +(MOCK_RSSI_BASE + (Math.random() * 10 - 5)).toFixed(1),
        snr: +(MOCK_SNR_BASE + (Math.random() * 4 - 2)).toFixed(1),
        temp: +(24 + Math.random() * 2).toFixed(1),
        hum: +(60 + Math.random() * 10).toFixed(1),
        bat: +(this.bat = Math.max(3.6, this.bat - 0.001)).toFixed(2),
      });
    }, MOCK_INTERVAL_MS);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  applyRadioConfig(_config: RadioConfig, onAck: ConfigAckCallback) {
    setTimeout(() => onAck(true), 400);
  }

  async getDeviceInfo() {
    return { name: "MockNode-001", firmware: "mock-v1.0.0" };
  }
}

// ─── BLE Transport ────────────────────────────────────────────────────────────
// Requires real ESP32 firmware with matching GATT profile (see lib/protocol.ts).

import { Device } from "react-native-ble-plx";

export class BleTransport implements ITransport {
  readonly id = "ble";
  private subscription: { remove(): void } | null = null;

  constructor(private device: Device) {}

  start(onPacket: PacketCallback) {
    this.stop();
    this.subscription = this.device.monitorCharacteristicForService(
      BLE_PROTOCOL.SERVICE_UUID,
      BLE_PROTOCOL.CHAR_PACKET_RX,
      (_err, char) => {
        if (!char?.value) return;
        try {
          onPacket(JSON.parse(atob(char.value)));
        } catch {}
      },
    );
  }

  stop() {
    this.subscription?.remove();
    this.subscription = null;
    this.device.cancelConnection().catch(() => {});
  }

  applyRadioConfig(config: RadioConfig, onAck: ConfigAckCallback) {
    const payload = btoa(JSON.stringify({ cmd: "SET_RADIO_CONFIG", ...config }));
    this.device
      .writeCharacteristicWithResponseForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_COMMAND,
        payload,
      )
      .then(() =>
        this.device.readCharacteristicForService(
          BLE_PROTOCOL.SERVICE_UUID,
          BLE_PROTOCOL.CHAR_RADIO_STATUS,
        ),
      )
      .then((c) => {
        try {
          const { success } = JSON.parse(atob(c.value ?? ""));
          onAck(success === true);
        } catch {
          onAck(false);
        }
      })
      .catch(() => onAck(false));
  }

  async getDeviceInfo() {
    try {
      const c = await this.device.readCharacteristicForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_DEVICE_INFO,
      );
      return JSON.parse(atob(c.value ?? ""));
    } catch {
      return { name: this.device.name ?? "Unknown", firmware: "unknown" };
    }
  }
}
