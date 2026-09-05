import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "weather.dayStats.v1";

// Mín/máx de temperatura del día calendario local. Persiste entre reinicios y
// se reinicia solo al cambiar de día (el plegado detecta la fecha en cada lectura).
export type DayStats = {
  date: string; // YYYY-MM-DD en hora local
  min: number;
  max: number;
};

export function localDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Pliega una lectura en el acumulado del día. Si la lectura cae en otro día
// (o no había acumulado), arranca uno nuevo.
export function foldReading(prev: DayStats | null, temp: number, ts: number): DayStats {
  const date = localDateKey(ts);
  if (!prev || prev.date !== date) {
    return { date, min: temp, max: temp };
  }
  return {
    date,
    min: Math.min(prev.min, temp),
    max: Math.max(prev.max, temp),
  };
}

export async function loadDayStats(): Promise<DayStats | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.date === "string" &&
      typeof parsed?.min === "number" &&
      typeof parsed?.max === "number"
    ) {
      return parsed as DayStats;
    }
  } catch {
    // Storage corrupto o ausente: arrancamos sin acumulado.
  }
  return null;
}

export async function saveDayStats(stats: DayStats): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Fallo de escritura: el acumulado sigue vivo en memoria; se reintenta
    // en la próxima lectura que cambie el mín/máx.
  }
}
