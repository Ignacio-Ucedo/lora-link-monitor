import { useState, useCallback, useRef, useEffect } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import { Device, Subscription } from "react-native-ble-plx";
import {
  scanForWeatherStation,
  connectToWeatherStation,
  subscribeToWeatherData,
  disconnectDevice,
  destroyManager,
  getBleManager,
} from "@/ble/weather-ble";

// La conexión se disuelve: el hook busca, conecta y reconecta solo, en
// background. La UI solo consume status/data; nunca inicia la conexión.
export type BLEStatus =
  | "starting"
  | "scanning"
  | "connecting"
  | "connected"
  | "offline"
  | "no-permission";

export type WeatherData = {
  t: number | null;
  h: number | null;
  w: number | null;
  d: string | null;
};

export type Reading = {
  ts: number;
  t: number | null;
  h: number | null;
  w: number | null;
};

// ~3 h de lecturas a una notificación cada ~2 s.
const HISTORY_MAX = 5400;

// Espera entre reintentos. Con BT recién encendido, el stack necesita ~3 s para
// iniciar, así que no vale la pena reintentar antes.
const RETRY_MS = 5000;

async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (Platform.Version >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(granted).every(
      (r) => r === PermissionsAndroid.RESULTS.GRANTED,
    );
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useWeatherBLE() {
  const [status, setStatus] = useState<BLEStatus>("starting");
  const [data, setData] = useState<WeatherData | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const scanRef = useRef<{ stop: () => void } | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const attemptingRef = useRef(false);

  const handleReading = useCallback((payload: WeatherData) => {
    const ts = Date.now();
    setData(payload);
    setLastUpdate(ts);
    setHistory((prev) => {
      const next =
        prev.length >= HISTORY_MAX ? prev.slice(prev.length - HISTORY_MAX + 1) : prev.slice();
      next.push({ ts, t: payload.t, h: payload.h, w: payload.w });
      return next;
    });
  }, []);

  const clearTimers = useCallback(() => {
    scanRef.current?.stop();
    scanRef.current = null;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    for (const ref of [scanTimeoutRef, retryTimerRef]) {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    }
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, []);

  const attempt = useCallback(async () => {
    if (!aliveRef.current || attemptingRef.current || demoTimerRef.current) return;
    attemptingRef.current = true;

    const granted = await requestBLEPermissions();
    if (!aliveRef.current) {
      attemptingRef.current = false;
      return;
    }
    if (!granted) {
      setStatus("no-permission");
      attemptingRef.current = false;
      return;
    }

    setStatus("scanning");
    let found = false;

    const scheduleRetry = () => {
      attemptingRef.current = false;
      if (!aliveRef.current) return;
      setStatus("offline");
      retryTimerRef.current = setTimeout(() => attempt(), RETRY_MS);
    };

    const onDevice = async (device: Device) => {
      if (found || !aliveRef.current) return;
      found = true;
      scanRef.current?.stop();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

      setStatus("connecting");
      try {
        const connected = await connectToWeatherStation(device.id);
        if (!aliveRef.current) return;
        deviceIdRef.current = connected.id;
        setStatus("connected");
        attemptingRef.current = false;

        subscriptionRef.current = subscribeToWeatherData(
          connected,
          handleReading,
          () => {
            // Error de notificación: la desconexión dispara la reconexión.
          },
        );

        connected.onDisconnected(() => {
          subscriptionRef.current?.remove();
          subscriptionRef.current = null;
          deviceIdRef.current = null;
          if (!aliveRef.current) return;
          setStatus("offline");
          retryTimerRef.current = setTimeout(() => attempt(), 2000);
        });
      } catch {
        scheduleRetry();
      }
    };

    scanRef.current = scanForWeatherStation(onDevice, () => scheduleRetry());

    // Timeout del scan: 10 s. Si el BT se apagó y volvió mientras escaneábamos,
    // el scan queda zombie sin notificar error → lo cortamos y reintentamos.
    scanTimeoutRef.current = setTimeout(() => {
      if (!found) {
        scanRef.current?.stop();
        scheduleRetry();
      }
    }, 10_000);
  }, [handleReading]);

  // Solo desarrollo: simula lecturas para iterar la UI sin la estación física.
  const startDemo = useCallback(() => {
    if (!__DEV__) return;
    clearTimers();
    attemptingRef.current = false;

    const sample = (ts: number): WeatherData => {
      const s = ts / 1000;
      return {
        t: 18.2 + 3.5 * Math.sin(s / 1900),
        h: 55 + 8 * Math.sin(s / 2600 + 1),
        w: Math.max(0, 11 + 7 * Math.sin(s / 700)),
        d: "NE",
      };
    };

    // Sembrar 3 h de historia para ver sparkline/tendencia/min-máx al instante.
    const now = Date.now();
    const seed: Reading[] = [];
    for (let i = 180; i > 0; i--) {
      const ts = now - i * 60_000;
      const p = sample(ts);
      seed.push({ ts, t: p.t, h: p.h, w: p.w });
    }
    setHistory(seed);

    const tick = () => handleReading(sample(Date.now()));
    tick();
    demoTimerRef.current = setInterval(tick, 2000);
    setStatus("connected");
  }, [clearTimers, handleReading]);

  useEffect(() => {
    aliveRef.current = true;
    attempt();

    // Escuchar cambios de estado del BT: cuando vuelve a PoweredOn tras estar
    // apagado, forzamos un nuevo intento inmediato (el scan anterior ya murió).
    const manager = getBleManager();
    let btSub: { remove: () => void } | null = null;
    if (manager) {
      btSub = manager.onStateChange((state) => {
        if (state === "PoweredOn" && aliveRef.current && !attemptingRef.current && !demoTimerRef.current) {
          clearTimers();
          attempt();
        }
      }, true);
    }

    return () => {
      aliveRef.current = false;
      btSub?.remove();
      clearTimers();
      if (deviceIdRef.current) disconnectDevice(deviceIdRef.current);
      deviceIdRef.current = null;
      destroyManager();
    };
  }, [attempt, clearTimers]);

  return { status, data, history, lastUpdate, startDemo };
}
