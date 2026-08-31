import { useState, useCallback, useRef, useEffect } from "react";
import { Device, Subscription } from "react-native-ble-plx";
import {
  scanForWeatherStation,
  connectToWeatherStation,
  subscribeToWeatherData,
  disconnectDevice,
} from "@/ble/weather-ble";

export type BLEStatus = "idle" | "scanning" | "connecting" | "connected" | "error";

export type WeatherData = {
  t: number | null;
  h: number | null;
  w: number;
  d: string | null;
};

export function useWeatherBLE() {
  const [status, setStatus] = useState<BLEStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherData | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const scanRef = useRef<{ stop: () => void } | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    scanRef.current?.stop();
    scanRef.current = null;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
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

  const connect = useCallback(async () => {
    cleanup();
    setError(null);
    setData(null);
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
          (payload) => setData(payload),
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
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { status, error, data, connect, disconnect };
}
