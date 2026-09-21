export const DEVICE_NAME = "WeatherStation";

export const SERVICE_UUID = "12340000-1234-1234-1234-123456789abc";
export const CHARACTERISTIC_UUID = "12340001-1234-1234-1234-123456789abc";
export const CONFIG_CHARACTERISTIC_UUID = "12340002-1234-1234-1234-123456789abc";

// Tasas de muestreo ofrecidas en Ajustes (label → ms).
export const SAMPLE_RATES: { label: string; ms: number }[] = [
  { label: "2 s", ms: 2000 },
  { label: "5 s", ms: 5000 },
  { label: "30 s", ms: 30000 },
  { label: "2 min", ms: 120000 },
  { label: "5 min", ms: 300000 },
  { label: "30 min", ms: 1800000 },
  { label: "1 h", ms: 3600000 },
];
