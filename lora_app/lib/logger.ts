// Configurar en .env.local:  EXPO_PUBLIC_LOG_SERVER=http://<ip-de-tu-pc>:9999
const SERVER = process.env.EXPO_PUBLIC_LOG_SERVER ?? "";

type Level = "debug" | "info" | "warn" | "error";

function emit(tag: string, level: Level, msg: string, data?: unknown): void {
  const ts = Date.now();
  const prefix = `[${tag}][${level.toUpperCase()}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${msg}`, data);
  } else {
    console.log(`${prefix} ${msg}`);
  }

  if (!SERVER) return;

  fetch(`${SERVER}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ts, tag, level, msg, data }),
  }).catch(() => {});
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => emit(tag, "debug", msg, data),
  info:  (tag: string, msg: string, data?: unknown) => emit(tag, "info",  msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => emit(tag, "warn",  msg, data),
  error: (tag: string, msg: string, data?: unknown) => emit(tag, "error", msg, data),
};
