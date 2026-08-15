#!/usr/bin/env node
// Servidor de logs para depuración WiFi.
// Uso: npm run logs   (desde lora_app/)
// Luego poné EXPO_PUBLIC_LOG_SERVER=http://<ip-de-esta-pc>:9999 en .env.local

import http from "http";

const PORT = process.env.LOG_PORT ? Number(process.env.LOG_PORT) : 9999;

const C = {
  debug: "\x1b[90m",
  info:  "\x1b[36m",
  warn:  "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  green: "\x1b[32m",
};

const server = http.createServer((req, res) => {
  // CORS para fetch desde React Native
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/log") {
    res.writeHead(404).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const { ts, tag, level, msg, data } = JSON.parse(body);
      const time = new Date(ts).toISOString().slice(11, 23); // HH:MM:SS.mmm
      const color = C[level] ?? C.reset;
      const lvlStr = level.toUpperCase().padEnd(5);
      const tagStr = `[${tag}]`.padEnd(14);
      const dataStr = data !== undefined ? " " + JSON.stringify(data) : "";
      console.log(`${C.debug}${time}${C.reset} ${color}${C.bold}${lvlStr}${C.reset} ${C.debug}${tagStr}${C.reset} ${msg}${color}${dataStr}${C.reset}`);
    } catch {
      console.log("RAW:", body);
    }
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const addr = server.address();
  console.log(`${C.green}${C.bold}Log server escuchando en :${addr.port}${C.reset}`);
  console.log(`${C.debug}Configurá en .env.local:${C.reset}`);
  console.log(`  EXPO_PUBLIC_LOG_SERVER=http://<ip-de-esta-pc>:${addr.port}\n`);
});

server.on("error", (err) => {
  console.error(`${C.error}Error al iniciar el servidor: ${err.message}${C.reset}`);
  process.exit(1);
});
