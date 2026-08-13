import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MetricsEngine } from "@/lib/metrics-engine";
import { evaluateLinkQuality } from "@/lib/link-quality";
import { ITransport, MockTransport } from "@/lib/transport";
import {
  DEFAULT_RADIO_CONFIG,
  EMPTY_STATS,
  type LinkQuality,
  type Packet,
  type RadioConfig,
  type SessionStatistics,
  type TransportMode,
} from "@/lib/models";

export type AckStatus = "idle" | "pending" | "ok" | "error";

interface SessionContextValue {
  mode: TransportMode;
  packets: Packet[];
  stats: SessionStatistics;
  linkQuality: LinkQuality;
  radioConfig: RadioConfig;
  configAckStatus: AckStatus;
  reset: () => void;
  applyConfig: (config: RadioConfig) => void;
  applyDeviceName: (name: string, onResult: (ok: boolean) => void) => void;
  applyWifiCredentials: (ssid: string, password: string, onResult: (ok: boolean) => void) => void;
  switchToMock: () => void;
  switchToBle: (transport: ITransport) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef(new MetricsEngine());
  const transportRef = useRef<ITransport>(new MockTransport());

  const [mode, setMode] = useState<TransportMode>("mock");
  const [packets, setPackets] = useState<Packet[]>([]);
  const [stats, setStats] = useState<SessionStatistics>(EMPTY_STATS);
  const [linkQuality, setLinkQuality] = useState<LinkQuality>("NO_LINK");
  const [radioConfig, setRadioConfig] = useState<RadioConfig>(DEFAULT_RADIO_CONFIG);
  const [configAckStatus, setConfigAckStatus] = useState<AckStatus>("idle");

  const onPacket = useCallback((p: Packet) => {
    engineRef.current.addPacket(p);
    setPackets((prev) => [p, ...prev].slice(0, 300));
  }, []);

  useEffect(() => {
    transportRef.current.start(onPacket);
    return () => transportRef.current.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tick = setInterval(() => {
      const s = engineRef.current.getStatistics();
      setStats(s);
      setLinkQuality(evaluateLinkQuality(s, Date.now()));
    }, 500);
    return () => clearInterval(tick);
  }, []);

  const reset = useCallback(() => {
    transportRef.current.stop();
    engineRef.current.reset();
    setPackets([]);
    setStats(EMPTY_STATS);
    setLinkQuality("NO_LINK");
    transportRef.current.start(onPacket);
  }, [onPacket]);

  const applyConfig = useCallback((config: RadioConfig) => {
    setRadioConfig(config);
    setConfigAckStatus("pending");
    transportRef.current.applyRadioConfig(config, (ok) => {
      setConfigAckStatus(ok ? "ok" : "error");
      setTimeout(() => setConfigAckStatus("idle"), 3000);
    });
  }, []);

  const applyDeviceName = useCallback(
    (name: string, onResult: (ok: boolean) => void) => {
      transportRef.current.sendDeviceName(name, onResult);
    },
    [],
  );

  const applyWifiCredentials = useCallback(
    (ssid: string, password: string, onResult: (ok: boolean) => void) => {
      transportRef.current.sendWifiCredentials(ssid, password, onResult);
    },
    [],
  );

  const switchTransport = useCallback(
    (next: ITransport, nextMode: TransportMode) => {
      transportRef.current.stop();
      engineRef.current.reset();
      setPackets([]);
      setStats(EMPTY_STATS);
      setLinkQuality("NO_LINK");
      transportRef.current = next;
      setMode(nextMode);
      next.start(onPacket);
    },
    [onPacket],
  );

  const switchToMock = useCallback(
    () => switchTransport(new MockTransport(), "mock"),
    [switchTransport],
  );

  const switchToBle = useCallback(
    (transport: ITransport) => switchTransport(transport, "ble"),
    [switchTransport],
  );

  return (
    <SessionContext.Provider
      value={{
        mode,
        packets,
        stats,
        linkQuality,
        radioConfig,
        configAckStatus,
        reset,
        applyConfig,
        applyDeviceName,
        applyWifiCredentials,
        switchToMock,
        switchToBle,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
