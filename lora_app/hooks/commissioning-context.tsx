import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { CommissioningState, CommissioningStep, RadioConfig } from "@/lib/models";

const STORAGE_KEY = "@commissioning_v1";

const INITIAL_STATE: CommissioningState = {
  step: "idle",
  gatewayConfig: null,
  gatewayName: null,
  gatewayGps: null,
  gatewayWifi: null,
  nodeId: null,
  nodeName: null,
  nodeType: null,
  nodeConfig: null,
  gpsCoords: null,
  linkTestResult: null,
  startedAt: null,
};

interface CommissioningContextValue {
  state: CommissioningState;
  loaded: boolean;
  goTo: (step: CommissioningStep) => void;
  setGatewayConfig: (config: RadioConfig) => void;
  setGatewayName: (name: string) => void;
  setGatewayGps: (coords: { lat: number; lon: number }) => void;
  setGatewayWifi: (ssid: string) => void;
  setNode: (id: string, name: string) => void;
  setNodeType: (type: string) => void;
  setNodeName: (name: string) => void;
  setNodeConfig: (config: RadioConfig) => void;
  setGpsCoords: (coords: { lat: number; lon: number }) => void;
  setLinkTestResult: (result: { pdr: number; rssiAvg: number; snrAvg: number }) => void;
  startNew: () => void;
  reset: () => void;
}

const CommissioningContext = createContext<CommissioningContextValue | null>(null);

export function useCommissioning() {
  const ctx = useContext(CommissioningContext);
  if (!ctx) throw new Error("useCommissioning must be used within CommissioningProvider");
  return ctx;
}

export function CommissioningProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CommissioningState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setState(JSON.parse(raw));
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const update = useCallback((patch: Partial<CommissioningState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const goTo = useCallback(
    (step: CommissioningStep) => update({ step }),
    [update],
  );

  const setGatewayConfig = useCallback(
    (gatewayConfig: RadioConfig) => update({ gatewayConfig }),
    [update],
  );

  const setGatewayName = useCallback(
    (gatewayName: string) => update({ gatewayName }),
    [update],
  );

  const setGatewayGps = useCallback(
    (gatewayGps: { lat: number; lon: number }) => update({ gatewayGps }),
    [update],
  );

  const setGatewayWifi = useCallback(
    (ssid: string) => update({ gatewayWifi: { ssid } }),
    [update],
  );

  const setNode = useCallback(
    (nodeId: string, nodeName: string) => update({ nodeId, nodeName }),
    [update],
  );

  const setNodeType = useCallback(
    (nodeType: string) => update({ nodeType }),
    [update],
  );

  const setNodeName = useCallback(
    (nodeName: string) => update({ nodeName }),
    [update],
  );

  const setNodeConfig = useCallback(
    (nodeConfig: RadioConfig) => update({ nodeConfig }),
    [update],
  );

  const setGpsCoords = useCallback(
    (gpsCoords: { lat: number; lon: number }) => update({ gpsCoords }),
    [update],
  );

  const setLinkTestResult = useCallback(
    (linkTestResult: { pdr: number; rssiAvg: number; snrAvg: number }) =>
      update({ linkTestResult }),
    [update],
  );

  const startNew = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      step: "node_connect",
      startedAt: Date.now(),
      gatewayConfig: prev.gatewayConfig,
      gatewayName: prev.gatewayName,
      gatewayGps: prev.gatewayGps,
      gatewayWifi: prev.gatewayWifi,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <CommissioningContext.Provider
      value={{
        state,
        loaded,
        goTo,
        setGatewayConfig,
        setGatewayName,
        setGatewayGps,
        setGatewayWifi,
        setNode,
        setNodeType,
        setNodeName,
        setNodeConfig,
        setGpsCoords,
        setLinkTestResult,
        startNew,
        reset,
      }}
    >
      {children}
    </CommissioningContext.Provider>
  );
}
