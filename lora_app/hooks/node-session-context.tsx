import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { AckPayload, RadioConfig } from "@/lib/models";
import { INodeTransport, MockNodeTransport, NodeBleTransport, ConfigAckCallback } from "@/lib/transport";
import { connectToDevice } from "@/ble/ble-manager";

export type NodeAckStatus = "idle" | "pending" | "ok" | "error";

const DEFAULT_TX_INTERVAL_MS = 2000;
const RECONNECT_INITIAL_DELAY_MS = 1500;
const RECONNECT_RETRY_DELAY_MS   = 3000;

interface NodeSessionValue {
  mode: "mock" | "ble";
  reconnecting: boolean;
  deviceInfo: { name: string; firmware: string } | null;
  nodeRadioConfig: RadioConfig | null;
  lastAck: AckPayload | null;
  lastAckTs: number | null;
  configAckStatus: NodeAckStatus;
  txRunning: boolean;
  txIntervalMs: number;
  connectNode: (transport: INodeTransport) => Promise<void>;
  disconnectNode: () => void;
  applyNodeConfig: (config: RadioConfig, onAck?: ConfigAckCallback) => void;
  pauseTx: () => void;
  resumeTx: () => void;
  sendOne: () => void;
  setTxInterval: (ms: number) => void;
}

const NodeSessionContext = createContext<NodeSessionValue | null>(null);

export function useNodeSession() {
  const ctx = useContext(NodeSessionContext);
  if (!ctx) throw new Error("useNodeSession must be used within NodeSessionProvider");
  return ctx;
}

export function NodeSessionProvider({ children }: { children: ReactNode }) {
  const transportRef = useRef<INodeTransport>(new MockNodeTransport());

  const [mode, setMode]               = useState<"mock" | "ble">("mock");
  const [reconnecting, setReconnecting] = useState(false);
  const [deviceInfo, setDeviceInfo]   = useState<{ name: string; firmware: string } | null>(null);
  const [nodeRadioConfig, setNodeRadioConfig] = useState<RadioConfig | null>(null);
  const [lastAck, setLastAck]         = useState<AckPayload | null>(null);
  const [lastAckTs, setLastAckTs]     = useState<number | null>(null);
  const [configAckStatus, setConfigAckStatus] = useState<NodeAckStatus>("idle");
  const [txRunning, setTxRunning]     = useState(true);
  const [txIntervalMs, setTxIntervalMs] = useState(DEFAULT_TX_INTERVAL_MS);

  // Mutable refs used inside async callbacks (avoid stale closure issues)
  const reconnectingRef    = useRef(false);
  const lastBleDeviceIdRef = useRef<string | null>(null);

  const onAck = useCallback((ack: AckPayload) => {
    setLastAck(ack);
    setLastAckTs(Date.now());
  }, []);

  useEffect(() => {
    transportRef.current.start(onAck);
    return () => transportRef.current.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-reconnect ──────────────────────────────────────────────────────────

  const handleDisconnect = useCallback((deviceId: string) => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    setReconnecting(true);

    // Fall back to mock so the rest of the UI stays alive
    transportRef.current.stop();
    const mock = new MockNodeTransport();
    transportRef.current = mock;
    mock.start(onAck);
    setMode("mock");

    const attempt = async () => {
      if (!reconnectingRef.current) return;
      try {
        const device = await connectToDevice(deviceId);
        if (!reconnectingRef.current) {
          device.cancelConnection().catch(() => {});
          return;
        }
        // Reconnected — wire up the new transport (minimal, no full re-init)
        const t = new NodeBleTransport(device);
        transportRef.current.stop();
        transportRef.current = t;
        t.start(onAck);
        t.onDisconnect(() => handleDisconnect(deviceId));
        setMode("ble");
        setLastAck(null);
        setLastAckTs(null);
        reconnectingRef.current = false;
        setReconnecting(false);
      } catch {
        if (reconnectingRef.current) {
          setTimeout(attempt, RECONNECT_RETRY_DELAY_MS);
        }
      }
    };

    setTimeout(attempt, RECONNECT_INITIAL_DELAY_MS);
  }, [onAck]);

  // ─── Public API ──────────────────────────────────────────────────────────────

  const connectNode = useCallback(
    async (transport: INodeTransport) => {
      // Cancel any in-flight reconnect
      reconnectingRef.current = false;
      setReconnecting(false);

      transportRef.current.stop();
      transportRef.current = transport;

      const info = await transport.getDeviceInfo();
      setDeviceInfo({ name: info.name, firmware: info.firmware });

      const config = await transport.readRadioConfig().catch(() => null);
      setNodeRadioConfig(config);

      setLastAck(null);
      setLastAckTs(null);
      setTxRunning(true);
      setTxIntervalMs(DEFAULT_TX_INTERVAL_MS);
      setMode(transport instanceof NodeBleTransport ? "ble" : "mock");
      transport.start(onAck);

      // Register disconnect handler for real BLE transports
      if (transport instanceof NodeBleTransport) {
        const deviceId = transport.bleDeviceId;
        lastBleDeviceIdRef.current = deviceId;
        transport.onDisconnect(() => handleDisconnect(deviceId));
      } else {
        lastBleDeviceIdRef.current = null;
      }
    },
    [onAck, handleDisconnect],
  );

  const disconnectNode = useCallback(() => {
    reconnectingRef.current = false;
    setReconnecting(false);
    lastBleDeviceIdRef.current = null;

    transportRef.current.stop();
    transportRef.current = new MockNodeTransport();
    setMode("mock");
    setDeviceInfo(null);
    setNodeRadioConfig(null);
    setLastAck(null);
    setLastAckTs(null);
    setTxRunning(true);
    setTxIntervalMs(DEFAULT_TX_INTERVAL_MS);
    transportRef.current.start(onAck);
  }, [onAck]);

  const applyNodeConfig = useCallback(
    (config: RadioConfig, onDone?: ConfigAckCallback) => {
      setConfigAckStatus("pending");
      transportRef.current.writeRadioConfig(config, (ok) => {
        setConfigAckStatus(ok ? "ok" : "error");
        if (ok) setNodeRadioConfig(config);
        setTimeout(() => setConfigAckStatus("idle"), 3000);
        onDone?.(ok);
      });
    },
    [],
  );

  const pauseTx    = useCallback(() => { transportRef.current.pauseTx();   setTxRunning(false); }, []);
  const resumeTx   = useCallback(() => { transportRef.current.resumeTx();  setTxRunning(true);  }, []);
  const sendOne    = useCallback(() => { transportRef.current.sendOne(); }, []);
  const setTxInterval = useCallback((ms: number) => {
    transportRef.current.setTxInterval(ms);
    setTxIntervalMs(ms);
  }, []);

  return (
    <NodeSessionContext.Provider
      value={{
        mode,
        reconnecting,
        deviceInfo,
        nodeRadioConfig,
        lastAck,
        lastAckTs,
        configAckStatus,
        txRunning,
        txIntervalMs,
        connectNode,
        disconnectNode,
        applyNodeConfig,
        pauseTx,
        resumeTx,
        sendOne,
        setTxInterval,
      }}
    >
      {children}
    </NodeSessionContext.Provider>
  );
}
