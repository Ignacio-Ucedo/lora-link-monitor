import { AckPayload, RadioConfig, DEFAULT_RADIO_CONFIG } from "./models";
import { BLE_PROTOCOL } from "./protocol";

export type PacketCallback = (p: import("./models").Packet) => void;
export type AckCallback = (ack: AckPayload) => void;
export type ConfigAckCallback = (success: boolean) => void;

// ─── Gateway transport ────────────────────────────────────────────────────────

export interface ITransport {
  readonly id: string;
  start(onPacket: PacketCallback): void;
  stop(): void;
  applyRadioConfig(config: RadioConfig, onAck: ConfigAckCallback): void;
  getDeviceInfo(): Promise<{ name: string; firmware: string; role?: string }>;
  sendDeviceName(name: string, onAck: ConfigAckCallback): void;
  sendWifiCredentials(ssid: string, password: string, onAck: ConfigAckCallback): void;
}

// ─── Node transport ───────────────────────────────────────────────────────────

export interface INodeTransport {
  readonly id: string;
  start(onAck: AckCallback): void;
  stop(): void;
  readRadioConfig(): Promise<RadioConfig>;
  writeRadioConfig(config: RadioConfig, onAck: ConfigAckCallback): void;
  getDeviceInfo(): Promise<{ name: string; firmware: string; role?: string }>;
  pauseTx(): void;
  resumeTx(): void;
  sendOne(): void;
  setTxInterval(ms: number): void;
}

// ─── Mock Gateway Transport ───────────────────────────────────────────────────

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
    return { name: "MockGateway-001", firmware: "mock-v1.0.0", role: "gateway" };
  }

  sendDeviceName(_name: string, onAck: ConfigAckCallback) {
    setTimeout(() => onAck(true), 400);
  }

  sendWifiCredentials(_ssid: string, _password: string, onAck: ConfigAckCallback) {
    setTimeout(() => onAck(true), 600);
  }
}

// ─── Mock Node Transport ──────────────────────────────────────────────────────

const MOCK_NODE_GW_RSSI = -76;
const MOCK_NODE_GW_SNR = 5.5;
const MOCK_NODE_LOSS_PROB = 0.08;

export class MockNodeTransport implements INodeTransport {
  readonly id = "mock-node";
  private timer: ReturnType<typeof setInterval> | null = null;
  private onAckRef: AckCallback | null = null;
  private seq = 1;
  private intervalMs = MOCK_INTERVAL_MS;
  private running = false;

  start(onAck: AckCallback) {
    this.stop();
    this.seq = 1;
    this.onAckRef = onAck;
    this.running = true;
    this._startTimer();
  }

  private _startTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    if (!this.running || !this.onAckRef) return;
    const cb = this.onAckRef;
    this.timer = setInterval(() => {
      if (Math.random() < MOCK_NODE_LOSS_PROB) return;
      cb({
        seqAck: this.seq++,
        rssiGw: +(MOCK_NODE_GW_RSSI + (Math.random() * 8 - 4)).toFixed(1),
        snrGw: +(MOCK_NODE_GW_SNR + (Math.random() * 3 - 1.5)).toFixed(1),
        delivered: true,
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.running = false;
    this.onAckRef = null;
  }

  pauseTx() {
    this.running = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  resumeTx() {
    this.running = true;
    this._startTimer();
  }

  sendOne() {
    if (!this.onAckRef) return;
    const cb = this.onAckRef;
    setTimeout(() => {
      cb({
        seqAck: this.seq++,
        rssiGw: +(MOCK_NODE_GW_RSSI + (Math.random() * 8 - 4)).toFixed(1),
        snrGw: +(MOCK_NODE_GW_SNR + (Math.random() * 3 - 1.5)).toFixed(1),
        delivered: true,
      });
    }, 400);
  }

  setTxInterval(ms: number) {
    this.intervalMs = ms;
    if (this.running) this._startTimer();
  }

  async readRadioConfig(): Promise<RadioConfig> {
    return { ...DEFAULT_RADIO_CONFIG };
  }

  writeRadioConfig(_config: RadioConfig, onAck: ConfigAckCallback) {
    setTimeout(() => onAck(true), 400);
  }

  async getDeviceInfo() {
    return { name: "MockNode-TX-001", firmware: "mock-v1.0.0", role: "node" };
  }
}

// ─── BLE Gateway Transport ────────────────────────────────────────────────────

import { Device } from "react-native-ble-plx";
import { logger } from "./logger";

export class GatewayBleTransport implements ITransport {
  readonly id = "ble-gateway";
  private subscription: { remove(): void } | null = null;

  constructor(private device: Device) {}

  start(onPacket: PacketCallback) {
    this.subscription?.remove();
    this.subscription = null;
    logger.info("BLE-GW", "monitor iniciado", { device: this.device.name ?? this.device.id });
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
    logger.info("BLE-GW", "transport detenido, cancelando conexión");
    this.subscription?.remove();
    this.subscription = null;
    this.device.cancelConnection().catch(() => {});
  }

  applyRadioConfig(config: RadioConfig, onAck: ConfigAckCallback) {
    const payload = btoa(JSON.stringify({ cmd: "SET_RADIO_CONFIG", ...config }));
    logger.info("BLE-GW", "applyRadioConfig: escribiendo config", config);
    this.device
      .writeCharacteristicWithResponseForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_COMMAND,
        payload,
      )
      .then(() => {
        logger.debug("BLE-GW", "applyRadioConfig: write ok, leyendo status...");
        return this.device.readCharacteristicForService(
          BLE_PROTOCOL.SERVICE_UUID,
          BLE_PROTOCOL.CHAR_RADIO_STATUS,
        );
      })
      .then((c) => {
        try {
          const parsed = JSON.parse(atob(c.value ?? ""));
          logger.info("BLE-GW", "applyRadioConfig: respuesta firmware", parsed);
          onAck(parsed.success === true);
        } catch (e) {
          logger.error("BLE-GW", "applyRadioConfig: error parseando status", { error: String(e), raw: c.value });
          onAck(false);
        }
      })
      .catch((e: unknown) => {
        logger.error("BLE-GW", "applyRadioConfig: error BLE", { error: (e as Error)?.message ?? String(e) });
        onAck(false);
      });
  }

  async getDeviceInfo() {
    try {
      const c = await this.device.readCharacteristicForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_DEVICE_INFO,
      );
      return JSON.parse(atob(c.value ?? ""));
    } catch {
      return { name: this.device.name ?? "Unknown", firmware: "unknown", role: "gateway" };
    }
  }

  sendDeviceName(name: string, onAck: ConfigAckCallback) {
    logger.info("BLE-GW", "sendDeviceName", { name });
    const payload = btoa(JSON.stringify({ cmd: "SET_DEVICE_NAME", name }));
    this.device
      .writeCharacteristicWithResponseForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_COMMAND,
        payload,
      )
      .then(() => { logger.info("BLE-GW", "sendDeviceName: ok"); onAck(true); })
      .catch((e: unknown) => { logger.error("BLE-GW", "sendDeviceName: error", { error: (e as Error)?.message ?? String(e) }); onAck(false); });
  }

  sendWifiCredentials(ssid: string, password: string, onAck: ConfigAckCallback) {
    logger.info("BLE-GW", "sendWifiCredentials", { ssid });
    const payload = btoa(JSON.stringify({ cmd: "SET_WIFI_CREDENTIALS", ssid, password }));
    this.device
      .writeCharacteristicWithResponseForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_COMMAND,
        payload,
      )
      .then(() => { logger.info("BLE-GW", "sendWifiCredentials: ok"); onAck(true); })
      .catch((e: unknown) => { logger.error("BLE-GW", "sendWifiCredentials: error", { error: (e as Error)?.message ?? String(e) }); onAck(false); });
  }
}

// Backward-compat alias — prefer GatewayBleTransport in new code.
export { GatewayBleTransport as BleTransport };

// ─── BLE Node Transport ───────────────────────────────────────────────────────

export class NodeBleTransport implements INodeTransport {
  readonly id = "ble-node";
  readonly bleDeviceId: string;
  private subscription: { remove(): void } | null = null;
  private disconnectSubscription: { remove(): void } | null = null;

  constructor(private device: Device) {
    this.bleDeviceId = device.id;
  }

  onDisconnect(cb: () => void): void {
    this.disconnectSubscription?.remove();
    logger.debug("BLE-NODE", "registrando handler de desconexión", { deviceId: this.bleDeviceId });
    this.disconnectSubscription = this.device.onDisconnected((_err) => {
      logger.warn("BLE-NODE", "device disconnected", { deviceId: this.bleDeviceId, error: (_err as Error)?.message });
      cb();
    });
  }

  start(onAck: AckCallback) {
    this.subscription?.remove();
    this.subscription = null;
    logger.info("BLE-NODE", "monitor ACK iniciado", { deviceId: this.bleDeviceId });
    this.subscription = this.device.monitorCharacteristicForService(
      BLE_PROTOCOL.SERVICE_UUID,
      BLE_PROTOCOL.CHAR_ACK_RX,
      (err, char) => {
        if (err) { logger.warn("BLE-NODE", "error en monitor ACK", { error: (err as Error)?.message }); return; }
        if (!char?.value) return;
        try {
          const ack = JSON.parse(atob(char.value));
          logger.debug("BLE-NODE", "ACK recibido", { seqAck: ack.seqAck, rssiGw: ack.rssiGw, snrGw: ack.snrGw });
          onAck(ack);
        } catch (e) {
          logger.error("BLE-NODE", "error parseando ACK notify", { error: String(e), raw: char.value });
        }
      },
    );
  }

  stop() {
    logger.info("BLE-NODE", "transport detenido", { deviceId: this.bleDeviceId });
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
    this.subscription?.remove();
    this.subscription = null;
    this.device.cancelConnection().catch(() => {});
  }

  async readRadioConfig(): Promise<RadioConfig> {
    const c = await this.device.readCharacteristicForService(
      BLE_PROTOCOL.SERVICE_UUID,
      BLE_PROTOCOL.CHAR_RADIO_CONFIG,
    );
    return JSON.parse(atob(c.value ?? ""));
  }

  writeRadioConfig(config: RadioConfig, onAck: ConfigAckCallback) {
    const payload = btoa(JSON.stringify({ cmd: "SET_RADIO_CONFIG", ...config }));
    logger.info("BLE-NODE", "writeRadioConfig: escribiendo config", config);
    this.device
      .writeCharacteristicWithResponseForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_COMMAND,
        payload,
      )
      .then(() => {
        logger.debug("BLE-NODE", "writeRadioConfig: write ok, leyendo status...");
        return this.device.readCharacteristicForService(
          BLE_PROTOCOL.SERVICE_UUID,
          BLE_PROTOCOL.CHAR_RADIO_STATUS,
        );
      })
      .then((c) => {
        try {
          const parsed = JSON.parse(atob(c.value ?? ""));
          logger.info("BLE-NODE", "writeRadioConfig: respuesta firmware", parsed);
          onAck(parsed.success === true);
        } catch (e) {
          logger.error("BLE-NODE", "writeRadioConfig: error parseando status", { error: String(e) });
          onAck(false);
        }
      })
      .catch((e: unknown) => {
        logger.error("BLE-NODE", "writeRadioConfig: error BLE", { error: (e as Error)?.message ?? String(e) });
        onAck(false);
      });
  }

  async getDeviceInfo() {
    try {
      const c = await this.device.readCharacteristicForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_DEVICE_INFO,
      );
      return JSON.parse(atob(c.value ?? ""));
    } catch {
      return { name: this.device.name ?? "Unknown", firmware: "unknown", role: "node" };
    }
  }

  private sendCommand(cmd: string, extra?: object) {
    this.device
      .writeCharacteristicWithoutResponseForService(
        BLE_PROTOCOL.SERVICE_UUID,
        BLE_PROTOCOL.CHAR_COMMAND,
        btoa(JSON.stringify({ cmd, ...extra })),
      )
      .catch(() => {});
  }

  pauseTx()                  { this.sendCommand("PAUSE_TX"); }
  resumeTx()                 { this.sendCommand("RESUME_TX"); }
  sendOne()                  { this.sendCommand("SEND_ONE"); }
  setTxInterval(ms: number)  { this.sendCommand("SET_TX_INTERVAL", { intervalMs: ms }); }
}
