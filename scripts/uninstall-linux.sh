#!/usr/bin/env bash
# =============================================================
# KioskoApp — Desinstalador para servidores Linux
# -------------------------------------------------------------
# Detiene y elimina el servicio systemd, opcionalmente hace
# backup de la BD y borra todos los archivos de instalación.
#
#     sudo ./uninstall-linux.sh
# =============================================================

set -euo pipefail

# -------------------------------------------------------------
# Colores
# -------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# -------------------------------------------------------------
# Constantes
# -------------------------------------------------------------
INSTALL_DIR="/opt/kioskoapp"
DATA_DIR="$INSTALL_DIR/data"
KEYS_DIR="$INSTALL_DIR/keys"
LOG_DIR="/var/log/kioskoapp"
DB_PATH="$DATA_DIR/custom.db"
LICENSE_DB_PATH="$DATA_DIR/license-server.db"
ENV_FILE="$INSTALL_DIR/kiosko.env"
SERVICE_NAME="kioskoapp"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SYSTEM_USER="kiosko"
SYSTEM_GROUP="kiosko"

# -------------------------------------------------------------
# Funciones de logging
# -------------------------------------------------------------
log_info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()  { echo -e "${BLUE}${BOLD}==>${NC} ${BOLD}$*${NC}"; }
die()       { log_err "$*"; exit 1; }

hr() { echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"; }

# Pregunta sí/no. $1=prompt, $2=default (y|n)
ask_yn() {
  local prompt="$1"
  local default="${2:-n}"
  local hint
  if [[ "$default" == "y" ]]; then hint="[S/n]"; else hint="[s/N]"; fi
  local answer
  read -r -p "$(echo -e "${BOLD}${prompt}${NC} ${hint} ") " answer </dev/tty
  answer="${answer:-$default}"
  case "$answer" in
    s|S|y|Y|si|sí|yes) return 0 ;;
    *) return 1 ;;
  esac
}

# =============================================================
# 0. Cabecera
# =============================================================
echo ""
hr
echo -e "${CYAN}${BOLD}  KioskoApp — Desinstalador para Linux${NC}"
hr
echo ""

# =============================================================
# 1. Verificar root / sudo
# =============================================================
log_step "Verificando permisos de administrador..."

if [[ $EUID -ne 0 ]]; then
  log_err "Este script debe ejecutarse como root o con sudo."
  echo ""
  echo -e "  Ejecutá: ${CYAN}sudo ./uninstall-linux.sh${NC}"
  echo ""
  exit 1
fi
log_ok "Ejecutando como root (UID=0)."

# =============================================================
# 2. Confirmación inicial
# =============================================================
echo ""
echo -e "${YELLOW}${BOLD}⚠️  Esto va a detener y eliminar KioskoApp del sistema.${NC}"
echo -e "   Se ofrecerá hacer backup de la BD antes de borrar."
echo -e "   El servicio systemd será detenido y deshabilitado."
echo ""

if ! ask_yn "¿Querés continuar con la desinstalación?" "n"; then
  log_info "Desinstalación cancelada por el usuario. No se modificó nada."
  exit 0
fi
echo ""

# =============================================================
# 3. Detener y deshabilitar el servicio
# =============================================================
log_step "Deteniendo servicio systemd '${SERVICE_NAME}'..."

if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}\.service"; then
  if systemctl is-active --quiet "${SERVICE_NAME}.service" 2>/dev/null; then
    systemctl stop "${SERVICE_NAME}.service" || log_warn "No se pudo detener el servicio (¿ya estaba parado?)."
    log_ok "Servicio detenido."
  else
    log_info "El servicio no estaba corriendo."
  fi

  if systemctl is-enabled --quiet "${SERVICE_NAME}.service" 2>/dev/null; then
    systemctl disable "${SERVICE_NAME}.service" || log_warn "No se pudo deshabilitar el servicio."
    log_ok "Servicio deshabilitado (no arrancará en boot)."
  else
    log_info "El servicio ya estaba deshabilitado."
  fi
else
  log_info "No se encontró el servicio '${SERVICE_NAME}' en systemd. Nada que detener."
fi

# =============================================================
# 4. Eliminar el archivo de servicio
# =============================================================
log_step "Eliminando archivo de servicio systemd..."

if [[ -f "$SERVICE_FILE" ]]; then
  rm -f "$SERVICE_FILE"
  log_ok "Service file eliminado: $SERVICE_FILE"
else
  log_info "No existía $SERVICE_FILE."
fi

systemctl daemon-reload
systemctl reset-failed "${SERVICE_NAME}.service" 2>/dev/null || true
log_ok "systemd recargado."

# =============================================================
# 5. Backup opcional de la BD
# =============================================================
echo ""
log_step "Backup de la base de datos..."

BACKUP_DIR="${HOME}"
BACKUP_FILE=""
BACKUP_FILE_LICENSE=""

# Determinar archivo real de la BD del license-server (puede ser el symlink data.db)
REAL_LICENSE_DB="$LICENSE_DB_PATH"
if [[ -L "$INSTALL_DIR/data.db" ]]; then
  REAL_LICENSE_DB="$(readlink -f "$INSTALL_DIR/data.db")"
fi

TODAY="$(date +%Y%m%d)"

if [[ -f "$DB_PATH" ]]; then
  if ask_yn "¿Hacer backup de la BD principal (custom.db) antes de borrar?" "y"; then
    BACKUP_FILE="${BACKUP_DIR}/kioskoapp-backup-${TODAY}.db"
    cp -a "$DB_PATH" "$BACKUP_FILE"
    log_ok "Backup creado: ${CYAN}${BACKUP_FILE}${NC}"
  else
    log_warn "No se hizo backup de la BD principal."
  fi
else
  log_info "No se encontró $DB_PATH (¿instalación incompleta?)."
fi

if [[ -f "$REAL_LICENSE_DB" ]]; then
  if ask_yn "¿Hacer backup de la BD del license-server?" "y"; then
    BACKUP_FILE_LICENSE="${BACKUP_DIR}/kioskoapp-license-backup-${TODAY}.db"
    cp -a "$REAL_LICENSE_DB" "$BACKUP_FILE_LICENSE"
    log_ok "Backup creado: ${CYAN}${BACKUP_FILE_LICENSE}${NC}"
  else
    log_warn "No se hizo backup de la BD de licencias."
  fi
fi

# =============================================================
# 6. Eliminar /opt/kioskoapp
# =============================================================
echo ""
log_step "Eliminando directorio de instalación..."

if [[ -d "$INSTALL_DIR" ]]; then
  if ask_yn "¿Borrar ${INSTALL_DIR} y todo su contenido (claves, BDs, app)?" "n"; then
    rm -rf "$INSTALL_DIR"
    log_ok "Directorio $INSTALL_DIR eliminado."
  else
    log_warn "Se conservó $INSTALL_DIR."
  fi
else
  log_info "No existía $INSTALL_DIR."
fi

# =============================================================
# 7. Eliminar logs
# =============================================================
log_step "Eliminando directorio de logs..."

if [[ -d "$LOG_DIR" ]]; then
  if ask_yn "¿Borrar los logs en ${LOG_DIR}?" "n"; then
    rm -rf "$LOG_DIR"
    log_ok "Directorio $LOG_DIR eliminado."
  else
    log_warn "Se conservó $LOG_DIR."
  fi
else
  log_info "No existía $LOG_DIR."
fi

# =============================================================
# 8. Eliminar usuario del sistema `kiosko`
# =============================================================
log_step "Eliminando usuario del sistema '${SYSTEM_USER}'..."

if id "$SYSTEM_USER" >/dev/null 2>&1; then
  if ask_yn "¿Eliminar el usuario y grupo del sistema '${SYSTEM_USER}'?" "n"; then
    # Asegurarse de que ningún proceso lo esté usando
    pkill -u "$SYSTEM_USER" 2>/dev/null || true
    sleep 1
    userdel "$SYSTEM_USER" 2>/dev/null || log_warn "No se pudo eliminar el usuario (¿procesos activos?)."
    groupdel "$SYSTEM_GROUP" 2>/dev/null || true
    log_ok "Usuario '${SYSTEM_USER}' eliminado."
  else
    log_warn "Se conservó el usuario '${SYSTEM_USER}'."
  fi
else
  log_info "El usuario '${SYSTEM_USER}' no existe."
fi

# =============================================================
# 9. Resumen final
# =============================================================
echo ""
hr
echo -e "${GREEN}${BOLD}  ✅  DESINSTALACIÓN COMPLETADA${NC}"
hr
echo ""
echo -e "${BOLD}Resumen:${NC}"
if [[ -f "$SERVICE_FILE" ]] || systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}\.service"; then
  echo -e "  ${RED}⚠${NC}  El servicio systemd todavía existe — recargá systemd manualmente:"
  echo -e "      ${CYAN}sudo systemctl daemon-reload${NC}"
else
  echo -e "  ${GREEN}✓${NC}  Servicio systemd eliminado."
fi
if [[ -d "$INSTALL_DIR" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  Se conservó ${CYAN}${INSTALL_DIR}${NC}."
else
  echo -e "  ${GREEN}✓${NC}  ${INSTALL_DIR} eliminado."
fi
if [[ -d "$LOG_DIR" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  Se conservó ${CYAN}${LOG_DIR}${NC}."
else
  echo -e "  ${GREEN}✓${NC}  ${LOG_DIR} eliminado."
fi
if id "$SYSTEM_USER" >/dev/null 2>&1; then
  echo -e "  ${YELLOW}⚠${NC}  Se conservó el usuario '${SYSTEM_USER}'."
else
  echo -e "  ${GREEN}✓${NC}  Usuario '${SYSTEM_USER}' eliminado."
fi

echo ""
if [[ -n "${BACKUP_FILE:-}" && -f "$BACKUP_FILE" ]]; then
  echo -e "${BOLD}📦 Backups creados:${NC}"
  echo -e "  BD principal:     ${CYAN}${BACKUP_FILE}${NC}"
  if [[ -n "${BACKUP_FILE_LICENSE:-}" && -f "$BACKUP_FILE_LICENSE" ]]; then
    echo -e "  BD de licencias:  ${CYAN}${BACKUP_FILE_LICENSE}${NC}"
  fi
  echo -e "  ${YELLOW}Guardá estos archivos en lugar seguro si querés reinstalar más tarde.${NC}"
fi
echo ""
echo -e "Para reinstalar KioskoApp, volvé a ejecutar ${CYAN}sudo ./install-linux.sh${NC}."
echo ""
