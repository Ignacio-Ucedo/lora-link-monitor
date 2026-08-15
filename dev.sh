#!/usr/bin/env bash
# dev.sh — desarrollo de la app LoRa
#
# Uso:
#   ./dev.sh                         modo día a día: Metro + hot reload
#   ./dev.sh --build                 compilar APK nativo + instalar en el teléfono
#   ./dev.sh --phone-ip <ip:puerto>  IP:puerto del teléfono (se guarda para la próxima)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/lora_app"
APK="$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.anonymous.lora_app"
CONFIG="$SCRIPT_DIR/.dev-config"

# ── colores ──────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' D='\033[0;90m' BOLD='\033[1m' NC='\033[0m'
step() { echo -e "\n${BOLD}${B}▶  $*${NC}"; }
ok()   { echo -e "${G}✓  $*${NC}"; }
warn() { echo -e "${Y}⚠  $*${NC}"; }
err()  { echo -e "${R}✗  $*${NC}"; exit 1; }

# ── opciones ─────────────────────────────────────────────────────────────────
BUILD_MODE=false
PHONE_IP=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --build)     BUILD_MODE=true ;;
    --phone-ip)  PHONE_IP="$2"; shift ;;
    *) warn "Opción desconocida: $1" ;;
  esac
  shift
done

# ── config persistente ────────────────────────────────────────────────────────
[[ -f "$CONFIG" ]] && source "$CONFIG"
[[ -n "${PHONE_IP_STORED:-}" && -z "$PHONE_IP" ]] && PHONE_IP="$PHONE_IP_STORED"

save_config() {
  echo "PHONE_IP_STORED=\"$PHONE_IP\"" > "$CONFIG"
}

# ── configurar Android SDK en el shell actual (no subshell) ──────────────────
setup_android_sdk() {
  local props="$APP_DIR/android/local.properties"
  local sdk=""

  if [[ -f "$props" ]]; then
    sdk=$(grep 'sdk.dir=' "$props" | cut -d= -f2- | tr -d '[:space:]')
  fi

  if [[ -z "$sdk" || ! -d "$sdk" ]]; then
    for candidate in \
      "$HOME/Android/Sdk" \
      "$HOME/Android/sdk" \
      "/opt/android-sdk" \
      "/usr/lib/android-sdk"; do
      [[ -d "$candidate" ]] && { sdk="$candidate"; break; }
    done
  fi

  if [[ -n "$sdk" && -d "$sdk" ]]; then
    export ANDROID_HOME="$sdk"
    export PATH="$sdk/platform-tools:$PATH"
  fi
}

find_adb() {
  command -v adb &>/dev/null && { echo "adb"; return; }
  echo ""
}

# ── conectar dispositivo ──────────────────────────────────────────────────────
connect_device() {
  local adb="$1"

  if "$adb" devices 2>/dev/null | grep -q "device$"; then
    local dev; dev=$("$adb" devices 2>/dev/null | grep "device$" | head -1 | cut -f1)
    ok "Dispositivo conectado: $dev"
    return 0
  fi

  if [[ -z "$PHONE_IP" ]]; then
    echo -e "${D}Ajustes > Opciones de desarrollador > Depuración inalámbrica${NC}"
    echo -ne "${BOLD}IP:puerto del teléfono (ej: 192.168.0.3:41657):${NC} "
    read -r PHONE_IP
  fi
  [[ "$PHONE_IP" != *:* ]] && PHONE_IP="$PHONE_IP:5555"
  save_config

  echo -e "${D}Conectando a $PHONE_IP...${NC}"
  if "$adb" connect "$PHONE_IP" 2>/dev/null | grep -q "connected"; then
    ok "Conectado a $PHONE_IP"
    return 0
  fi

  # Conexión fallida → flujo de vinculación (Wireless Debugging Android 11+)
  warn "No se pudo conectar. El dispositivo necesita vincularse primero."
  echo -e "${D}En el teléfono: Depuración inalámbrica > Vincular dispositivo con código${NC}"
  echo -ne "${BOLD}IP:puerto de vinculación:${NC} "
  read -r PAIR_ADDR
  echo -ne "${BOLD}Código de vinculación:${NC} "
  read -r PAIR_CODE

  # adb pair puede pedir confirmación interactiva; capturamos la salida para detectar error
  local pair_out
  pair_out=$("$adb" pair "$PAIR_ADDR" "$PAIR_CODE" 2>&1) || true
  echo "$pair_out"
  echo "$pair_out" | grep -qi "successfully\|éxito\|paired" || err "Vinculación fallida"

  "$adb" connect "$PHONE_IP" 2>&1 | grep -q "connected" || err "Conexión fallida tras vinculación"
  ok "Conectado a $PHONE_IP"
}

# ── main ──────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}━━━ LoRa Dev ━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ADB
setup_android_sdk
ADB=$(find_adb)
if [[ -z "$ADB" ]]; then
  warn "adb no encontrado. Instalando android-tools..."
  sudo pacman -S --noconfirm android-tools
  ADB="adb"
fi
ok "adb: $ADB"

# Dispositivo
step "Dispositivo"
connect_device "$ADB"

if [[ "$BUILD_MODE" == true ]]; then
  # ── modo build: compilar APK + instalar ──────────────────────────────────
  step "Compilando APK (gradle assembleDebug)"
  cd "$APP_DIR/android"
  ./gradlew assembleDebug --quiet
  cd "$SCRIPT_DIR"
  ok "APK: $APK"

  step "Instalando APK"
  [[ ! -f "$APK" ]] && err "APK no encontrado: $APK"
  "$ADB" install -r "$APK"
  ok "APK instalado"

  step "Lanzando app"
  "$ADB" shell am start -n "$PKG/.MainActivity" 2>/dev/null \
    || "$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 2>/dev/null \
    || warn "No se pudo lanzar automáticamente, abrila a mano"

  step "Servidor de logs en :9999  (Ctrl+C para salir)"
  echo -e "${D}Esperando eventos del teléfono...${NC}\n"
  cd "$APP_DIR"
  node scripts/log-server.mjs

else
  # ── modo día a día: Metro + hot reload ───────────────────────────────────
  echo -e "${D}Tip: para compilar APK nativo usá ./dev.sh --build${NC}"

  # Tunelizar Metro a través de ADB para no depender del firewall de la red
  "$ADB" reverse tcp:8081 tcp:8081 &>/dev/null && ok "Puerto 8081 tuneliado via ADB"

  step "Iniciando Metro"
  cd "$APP_DIR"
  npx expo start --android --localhost
fi
