#!/usr/bin/env bash
# =============================================================
# kiosko-runtime.sh — Runtime de producción para KioskoApp
# =============================================================
# Inicia y supervisa los dos servicios que componen KioskoApp:
#   1. license-server  — binario Bun compilado, puerto 3042
#   2. Next.js app     — standalone build (node app/server.js), puerto 3000
#
# Pensado para ser ejecutado por launchd (macOS) o systemd (Linux)
# como servicio supervisado. Si cualquiera de los dos servicios muere
# inesperadamente, el script mata al otro y sale con código no-cero
# para que el supervisor (KeepAlive / Restart=on-failure) lo reinicie.
#
# ─── Variables de entorno esperadas en kiosko.env ───────────
#   DATABASE_URL          Ruta a la BD SQLite.
#                         Ej: file:/opt/kioskoapp/data/custom.db
#   NODE_ENV              production (default del script si no está definida)
#   PORT                  3000 (default del script)
#   LICENSE_SERVER_URL    http://localhost:3042 (default del script)
#   ADMIN_API_KEY         Clave hex 32 chars para endpoints admin del
#                         license-server (issue / revoke / list / etc.)
#   NEXTAUTH_SECRET       (si la app lo requiere)
#   Cualquier otra variable que la app consuma vía process.env
#
# ─── Layout del directorio de instalación ──────────────────
#   $DIR/
#     kiosko-runtime.sh    ← este script
#     kiosko.env           ← opcional (variables de entorno)
#     license-server       ← binario Bun compilado
#     app/
#       server.js          ← standalone Next.js
#       .next/static/      ← assets estáticos
#       public/            ← estáticos públicos
#     data/                ← BD SQLite y datos persistentes
#     logs/                ← logs de cada servicio + PID files
#     keys/                ← claves Ed25519 del license-server
#
# ─── Salida ────────────────────────────────────────────────
#   0  → cierre limpio (SIGTERM/SIGINT del supervisor)
#   1  → un servicio murió inesperadamente (supervisor reinicia)
# =============================================================

set -euo pipefail

# ─── Colores (sólo si stderr es un TTY; logs son archivos) ──
if [[ -t 2 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; NC=''
fi

# ─── Helpers de log (todo a stderr) ─────────────────────────
log()  { printf '%b[runtime %s] %s%b\n' "$CYAN"  "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$NC" >&2; }
ok()   { printf '%b[runtime %s] ✓ %s%b\n' "$GREEN"  "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$NC" >&2; }
warn() { printf '%b[runtime %s] ⚠ %s%b\n' "$YELLOW" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$NC" >&2; }
err()  { printf '%b[runtime %s] ✗ %s%b\n' "$RED"    "$(date '+%Y-%m-%d %H:%M:%S')" "$*" "$NC" >&2; }

# ─── Directorio raíz (donde vive este script) ───────────────
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# ─── PATH mínimo (los servicios no heredan un shell completo) ──
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.bun/bin:${PATH}"

# ─── Paths ──────────────────────────────────────────────────
ENV_FILE="$DIR/kiosko.env"
LICENSE_BIN="$DIR/license-server"
APP_SERVER="$DIR/app/server.js"
APP_LOG="$DIR/logs/app.log"
LICENSE_LOG="$DIR/logs/license-server.log"
APP_PID_FILE="$DIR/logs/app.pid"
LICENSE_PID_FILE="$DIR/logs/license-server.pid"

# ─── Estado global ──────────────────────────────────────────
APP_PID=""
LICENSE_PID=""
SERVICE_PID=""   # salida de start_service (NO usar $() porque create subshell)
EXIT_CODE=0
CLEANING_UP=0

# ─── Crear directorios necesarios ───────────────────────────
mkdir -p "$DIR/data" "$DIR/logs" "$DIR/keys"
chmod 700 "$DIR/keys" 2>/dev/null || true

# ─── Cargar kiosko.env si existe (exporta todas las vars) ───
if [[ -f "$ENV_FILE" ]]; then
  log "Cargando variables de entorno desde $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  warn "No se encontró $ENV_FILE — continuando con valores por defecto"
fi

# ─── Defaults robustos ──────────────────────────────────────
: "${NODE_ENV:=production}"
: "${PORT:=3000}"
: "${LICENSE_SERVER_URL:=http://localhost:3042}"
export NODE_ENV PORT LICENSE_SERVER_URL
[[ -n "${DATABASE_URL:-}" ]]  && export DATABASE_URL
[[ -n "${ADMIN_API_KEY:-}" ]] && export ADMIN_API_KEY

# ─── Validaciones de binarios requeridos ────────────────────
if [[ ! -x "$LICENSE_BIN" ]]; then
  err "No se encuentra el binario license-server en: $LICENSE_BIN"
  err "Compilar con: bun build mini-services/license-server/index.ts --compile --outfile license-server"
  exit 1
fi
if [[ ! -f "$APP_SERVER" ]]; then
  err "No se encuentra el servidor Next.js standalone en: $APP_SERVER"
  err "Asegurarse de copiar el directorio app/ con el build standalone completo"
  exit 1
fi

# ─── Detección de `wait -n` (bash 4.3+, no está en bash 3.2 de macOS) ──
WAIT_N_SUPPORTED=0
if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 3) )); then
  WAIT_N_SUPPORTED=1
fi

# =============================================================
# Funciones de servicio
# =============================================================

# start_service NAME PID_FILE LOG_FILE WORKDIR CMD...
#   Lanza CMD... con WORKDIR como cwd, en background, redirige
#   stdout+stderr a LOG_FILE, guarda el PID en PID_FILE.
#   Deja el PID en la variable global SERVICE_PID.
#
#   ⚠  NO usar $(start_service ...) — la sustitución de comandos
#      corre en una subshell, los jobs `&` quedarían huérfanos
#      y `wait -n` del caller los desconoce (retorna 127).
start_service() {
  local name="$1"; shift
  local pid_file="$1"; shift
  local log_file="$1"; shift
  local workdir="$1"; shift

  log "Iniciando $name..."
  pushd "$workdir" >/dev/null
  "$@" >> "$log_file" 2>&1 &
  SERVICE_PID=$!
  popd >/dev/null

  echo "$SERVICE_PID" > "$pid_file"
  ok "$name iniciado (PID=$SERVICE_PID, log=$log_file)"
}

# stop_service NAME PID_FILE
#   Envía SIGTERM, espera hasta 5s; si no termina, envía SIGKILL.
#   Limpia el PID_FILE. Idempotente.
stop_service() {
  local name="$1"
  local pid_file="$2"
  local pid=""

  [[ -f "$pid_file" ]] && pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    log "$name (PID=$pid) ya no está corriendo"
    rm -f "$pid_file"
    return 0
  fi

  log "Enviando SIGTERM a $name (PID=$pid)..."
  kill -TERM "$pid" 2>/dev/null || true

  # Esperar hasta 5 segundos (50 × 100ms)
  local i=0
  while (( i < 50 )); do
    if ! kill -0 "$pid" 2>/dev/null; then
      ok "$name detenido limpiamente (PID=$pid)"
      rm -f "$pid_file"
      return 0
    fi
    sleep 0.1
    i=$((i+1))
  done

  warn "$name no respondió a SIGTERM en 5s — enviando SIGKILL"
  kill -KILL "$pid" 2>/dev/null || true
  sleep 0.5
  rm -f "$pid_file"
  ok "$name forzado a detenerse (PID=$pid)"
}

# health_check LABEL URL EXPECTED_REGEX MAX_TRIES
#   Hace curl a URL; considera OK si el código HTTP matchea EXPECTED_REGEX.
#   Reintenta cada 1s hasta MAX_TRIES veces.
#   Retorna 0 si OK, 1 si falla.
health_check() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local max_tries="${4:-30}"
  local i=0
  local status="000"

  while (( i < max_tries )); do
    status="$(curl -sS -o /dev/null -w '%{http_code}' \
                --max-time 3 --connect-timeout 2 "$url" 2>/dev/null || echo "000")"
    if echo "$status" | grep -qE "$expected"; then
      ok "Health $label OK → HTTP $status (intentos=$((i+1)))"
      return 0
    fi
    sleep 1
    i=$((i+1))
  done
  err "Health $label FALLÓ → HTTP $status después de $max_tries intentos"
  return 1
}

# cleanup
#   Idempotente (guarda CLEANING_UP). Detiene ambos servicios y
#   limpia PID files. No llama exit() — el caller decide el código.
cleanup() {
  if (( CLEANING_UP == 1 )); then
    return 0
  fi
  CLEANING_UP=1
  log "Iniciando limpieza (exit_code=$EXIT_CODE)..."
  stop_service "Next.js app"    "$APP_PID_FILE" || true
  stop_service "license-server" "$LICENSE_PID_FILE" || true
  log "Limpieza completada"
}

# ─── Traps ──────────────────────────────────────────────────
# SIGINT/SIGTERM = cierre limpio solicitado por el supervisor
# (launchctl unload / systemctl stop). Salimos con 0 para que
# KeepAlive/Restart=on-failure NO nos reinicie.
#
# Nota: cuando un signal llega durante `wait`, bash ejecuta el
# trap correspondiente. El trap llama a `exit $EXIT_CODE`, lo que
# dispara el trap EXIT (idempotente vía CLEANING_UP).
trap 'log "SIGINT recibido — cerrando limpiamente";  EXIT_CODE=0; cleanup; exit $EXIT_CODE' INT
trap 'log "SIGTERM recibido — cerrando limpiamente"; EXIT_CODE=0; cleanup; exit $EXIT_CODE' TERM
trap 'cleanup' EXIT

# =============================================================
# Banner de inicio
# =============================================================
{
  echo "============================================================"
  echo " KioskoApp Runtime — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "------------------------------------------------------------"
  echo " Directorio:    $DIR"
  echo " NODE_ENV:      $NODE_ENV"
  echo " PORT (app):    $PORT"
  echo " License URL:   $LICENSE_SERVER_URL"
  echo " DATABASE_URL:  ${DATABASE_URL:-<no definida>}"
  echo " ADMIN_API_KEY: ${ADMIN_API_KEY:+<configurada>}${ADMIN_API_KEY:-<no definida>}"
  echo " Bash:          ${BASH_VERSION}"
  echo " wait -n:       $([ $WAIT_N_SUPPORTED = 1 ] && echo 'soportado' || echo 'no soportado — polling')"
  echo "------------------------------------------------------------"
} >&2

# =============================================================
# Lanzamiento de servicios
# =============================================================

# 1) license-server (binario Bun compilado, puerto 3042)
start_service "license-server" \
  "$LICENSE_PID_FILE" "$LICENSE_LOG" "$DIR" "$LICENSE_BIN"
LICENSE_PID="$SERVICE_PID"

# 2) Esperar a que license-server inicialice (BD, claves, socket)
log "Esperando 2s a que license-server inicialice..."
sleep 2

# Si el license-server ya murió en este.sleep, abortar antes de arrancar la app
if ! kill -0 "$LICENSE_PID" 2>/dev/null; then
  err "license-server (PID=$LICENSE_PID) murió durante el arranque — abortando"
  err "Revisar $LICENSE_LOG para detalles"
  EXIT_CODE=1
  exit $EXIT_CODE
fi

# 3) Next.js app (standalone build, puerto 3000)
#    Pasamos NODE_ENV y PORT explícitamente además de tenerlos exportados,
#    para mayor robustez si el runtime del supervisor resetea el entorno.
start_service "Next.js app" \
  "$APP_PID_FILE" "$APP_LOG" "$DIR/app" \
  env NODE_ENV="$NODE_ENV" PORT="$PORT" node server.js
APP_PID="$SERVICE_PID"

# =============================================================
# Health checks post-arranque
# =============================================================
log "Ejecutando health checks..."
HC_OK=1
health_check "license-server" "http://localhost:3042/api/health" '^(200)$' 15 || HC_OK=0
health_check "Next.js app"    "http://localhost:${PORT}/"        '^(200|302|307)$' 30 || HC_OK=0

if (( HC_OK )); then
  ok "Ambos servicios están saludables — entrando en supervisión"
else
  err "Health checks fallaron — los servicios pueden tener problemas (revisar logs)"
  err "Continuando igualmente; si un servicio muere, el supervisor reiniciará"
fi

# =============================================================
# Loop de supervisión
# =============================================================
log "Supervisión activa: license-server PID=$LICENSE_PID, app PID=$APP_PID"

CRASH=0
if (( WAIT_N_SUPPORTED )); then
  # wait -n: bloquea hasta que cualquier job en background termine.
  # Si llega una señal (SIGTERM/SIGINT), bash interrumpe wait y
  # ejecuta el trap correspondiente, que sale con EXIT_CODE=0.
  set +e
  wait -n
  WAIT_RC=$?
  set -e

  # Si llegamos aquí, un job terminó (no fue signal — el trap ya
  # habría salido). Diagnosticar cuál murió.
  log "wait -n retornó código $WAIT_RC"
  CRASH=1
  if ! kill -0 "$LICENSE_PID" 2>/dev/null; then
    err "license-server (PID=$LICENSE_PID) murió inesperadamente"
  elif ! kill -0 "$APP_PID" 2>/dev/null; then
    err "Next.js app (PID=$APP_PID) murió inesperadamente"
  else
    err "Un job en background terminó (código $WAIT_RC) — no se pudo identificar cuál"
  fi
else
  # Polling (bash 3.2 de macOS, sin wait -n): cada 1s verificar
  # si ambos siguen vivos.
  while true; do
    if ! kill -0 "$LICENSE_PID" 2>/dev/null; then
      err "license-server (PID=$LICENSE_PID) murió inesperadamente"
      CRASH=1
      break
    fi
    if ! kill -0 "$APP_PID" 2>/dev/null; then
      err "Next.js app (PID=$APP_PID) murió inesperadamente"
      CRASH=1
      break
    fi
    sleep 1
  done
fi

if (( CRASH )); then
  EXIT_CODE=1
  err "Un servicio murió — saliendo con código 1 para que el supervisor reinicie"
else
  EXIT_CODE=0
fi

exit $EXIT_CODE
