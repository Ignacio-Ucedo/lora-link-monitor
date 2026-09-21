import { createContext, useContext, ReactNode } from "react";
import { useWeatherBLE, BLEStatus, WeatherData, Reading } from "./useWeatherBLE";
import { StationConfig } from "@/ble/weather-ble";
import { DayStats } from "@/storage/dayStats";

type WeatherContextValue = {
  status: BLEStatus;
  data: WeatherData | null;
  history: Reading[];
  lastUpdate: number | null;
  dayStats: DayStats | null;
  config: StationConfig | null;
  startDemo: () => void;
  setSampleInterval: (ms: number) => Promise<boolean>;
  calibrateNorth: () => Promise<boolean>;
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
