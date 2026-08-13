export type LinkQuality = "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR" | "NO_LINK";
export type TransportMode = "mock" | "ble";
export type DeviceRole = "gateway" | "node";

// Sent by node over CHAR_ACK_RX after receiving a LoRa ACK from the gateway.
export interface AckPayload {
  seqAck: number;
  rssiGw: number;
  snrGw: number;
  delivered: boolean;
}

export type CommissioningStep =
  | "idle"
  | "gateway_setup"
  | "gateway_identify"
  | "node_connect"
  | "node_identify"
  | "node_config"
  | "verify_link"
  | "gps"
  | "complete";

export interface CommissioningState {
  step: CommissioningStep;
  gatewayConfig: RadioConfig | null;
  gatewayName: string | null;
  gatewayGps: { lat: number; lon: number } | null;
  gatewayWifi: { ssid: string } | null;
  nodeId: string | null;
  nodeName: string | null;
  nodeType: string | null;
  nodeConfig: RadioConfig | null;
  gpsCoords: { lat: number; lon: number } | null;
  linkTestResult: { pdr: number; rssiAvg: number; snrAvg: number } | null;
  startedAt: number | null;
}

export interface RadioConfig {
  freqHz: number;
  sf: 7 | 8 | 9 | 10 | 11 | 12;
  bwKhz: 125 | 250 | 500;
  cr: "4/5" | "4/6" | "4/7" | "4/8";
  txPowerDbm: number;
}

export const DEFAULT_RADIO_CONFIG: RadioConfig = {
  freqHz: 916_800_000,
  sf: 7,
  bwKhz: 125,
  cr: "4/5",
  txPowerDbm: 14,
};

export interface Packet {
  seq: number;
  timestamp: number;
  rssi: number;
  snr: number;
  temp: number;
  hum: number;
  bat: number;
}

export interface RadioMetrics {
  rssiCurrent: number;
  rssiMin: number;
  rssiMax: number;
  rssiAvg: number;
  snrCurrent: number;
  snrMin: number;
  snrMax: number;
  snrAvg: number;
}

export interface SessionStatistics {
  txCount: number;
  rxCount: number;
  lostCount: number;
  pdr: number;
  lastPacketTs: number | null;
  avgIntervalMs: number | null;
  metrics: RadioMetrics | null;
}

export const EMPTY_STATS: SessionStatistics = {
  txCount: 0,
  rxCount: 0,
  lostCount: 0,
  pdr: 0,
  lastPacketTs: null,
  avgIntervalMs: null,
  metrics: null,
};
