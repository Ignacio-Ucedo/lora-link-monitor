import { createContext, useContext, ReactNode } from "react";
import { useWeatherBLE, BLEStatus, WeatherData, Reading } from "./useWeatherBLE";

type WeatherContextValue = {
  status: BLEStatus;
  data: WeatherData | null;
  history: Reading[];
  lastUpdate: number | null;
  startDemo: () => void;
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
