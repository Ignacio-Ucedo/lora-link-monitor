import { createContext, useContext, ReactNode } from "react";
import { useWeatherBLE, BLEStatus, WeatherData } from "./useWeatherBLE";

type WeatherContextValue = {
  status: BLEStatus;
  error: string | null;
  data: WeatherData | null;
  connect: () => void;
  disconnect: () => void;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const ble = useWeatherBLE();
  return <WeatherContext.Provider value={ble}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be used inside WeatherProvider");
  return ctx;
}
