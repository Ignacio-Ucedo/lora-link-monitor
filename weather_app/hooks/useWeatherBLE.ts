import { useState, useCallback, useRef, useEffect } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import { Device, Subscription } from "react-native-ble-plx";
import {
  scanForWeatherStation,
  connectToWeatherStation,
  subscribeToWeatherData,
  disconnectDevice,
  destroyManager,
} from "@/ble/weather-ble";

export type BLEStatus = "idle" | "scanning" | "connecting" | "connected" | "error";

export type WeatherData = {
  t: number | null;
  h: number | null;
  w: number;
  d: string | null;
};

export type Reading = {
  ts: number;
  t: number | null;
  h: number | null;
  w: number;
};

// ~3 h de lecturas a una notificación cada ~2 s.
const HISTORY_MAX = 5400;

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
  const [status, setStatus] = useState<BLEStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherData | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const scanRef = useRef<{ stop: () => void } | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const cleanup = useCallback(() => {
    scanRef.current?.stop();
    scanRef.current = null;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    if (deviceId) disconnectDevice(deviceId);
    setDeviceId(null);
    setData(null);
    setStatus("idle");
    setError(null);
  }, [cleanup, deviceId]);

  // Solo desarrollo: simula lecturas para iterar la UI sin la estación física.
  const startDemo = useCallback(() => {
    if (!__DEV__) return;
    cleanup();
    setError(null);

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
  }, [cleanup, handleReading]);

  const connect = useCallback(async () => {
    cleanup();
    setError(null);
    setData(null);

    const granted = await requestBLEPermissions();
    if (!granted) {
      setError("Se necesitan permisos de Bluetooth para conectar");
      setStatus("error");
      return;
    }

    setStatus("scanning");

    let found = false;

    const onDevice = async (device: Device) => {
      if (found) return;
      found = true;
      scanRef.current?.stop();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

      setStatus("connecting");
      try {
        const connected = await connectToWeatherStation(device.id);
        setDeviceId(connected.id);
        setStatus("connected");

        subscriptionRef.current = subscribeToWeatherData(
          connected,
          handleReading,
          (err) => {
            setError(err.message);
            setStatus("error");
          },
        );

        connected.onDisconnected(() => {
          subscriptionRef.current?.remove();
          subscriptionRef.current = null;
          setStatus("idle");
          setDeviceId(null);
        });
      } catch (err: any) {
        setError(err.message ?? "Error al conectar");
        setStatus("error");
      }
    };

    scanRef.current = scanForWeatherStation(onDevice, (err) => {
      setError(err.message);
      setStatus("error");
    });

    scanTimeoutRef.current = setTimeout(() => {
      if (!found) {
        scanRef.current?.stop();
        setError("No se encontró WeatherStation (10 s)");
        setStatus("error");
      }
    }, 10_000);
  }, [cleanup, handleReading]);

  // Al desmontar: además de limpiar scan/suscripción, destruir el BleManager
  // para no filtrar el cliente GATT nativo entre recargas de JS.
  useEffect(
    () => () => {
      cleanup();
      destroyManager();
    },
    [cleanup],
  );

  return { status, error, data, history, lastUpdate, connect, disconnect, startDemo };
}
