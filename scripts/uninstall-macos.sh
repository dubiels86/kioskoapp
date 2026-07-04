#!/bin/bash
# =============================================================
# KioskoApp — Desinstalador para macOS
# =============================================================
# Detiene el servicio, descarga el LaunchDaemon, elimina el plist
# y (opcionalmente) borra /Applications/KioskoApp.
# Ofrece hacer backup de la base de datos antes de borrar.
#
# Uso:
#   sudo ./scripts/uninstall-macos.sh
#
# Flags opcionales:
#   -y / --yes        No pedir confirmación (modo no-interactivo)
#   --keep-data       No borrar /Applications/KioskoApp (solo servicio)
#   --backup-dir DIR  Carpeta donde guardar el backup (default: ~/Desktop)
# =============================================================

set -euo pipefail

# -------------------------------------------------------------
# Colores
# -------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# -------------------------------------------------------------
# Constantes
# -------------------------------------------------------------
INSTALL_DIR="/Applications/KioskoApp"
DB_PATH="$INSTALL_DIR/data/custom.db"
LICENSE_DB_PATH="$INSTALL_DIR/data/license-server.db"
PLIST_PATH="/Library/LaunchDaemons/com.kioskoapp.plist"
PLIST_LABEL="com.kioskoapp"

# Opciones por defecto
ASSUME_YES="no"
KEEP_DATA="no"
BACKUP_DIR="${HOME}/Desktop"

# -------------------------------------------------------------
# Helpers
# -------------------------------------------------------------
log_info()    { echo -e "  ${CYAN}[INFO]${NC} $*"; }
log_success() { echo -e "  ${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "  ${YELLOW}[AVISO]${NC} $*"; }
log_error()   { echo -e "  ${RED}[ERROR]${NC} $*" >&2; }

die() {
  log_error "$*"
  exit 1
}

banner() {
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════"
  echo -e "  $*"
  echo -e "═══════════════════════════════════════════════════════════${NC}"
}

# Prompt yes/no. Retorna 0 si sí, 1 si no.
# Uso: confirm "¿Borrar?" [default-y|default-n]
confirm() {
  local prompt="$1"
  local default="${2:-default-n}"
  local hint
  if [[ "$default" == "default-y" ]]; then
    hint="[Y/n]"
  else
    hint="[y/N]"
  fi

  if [[ "$ASSUME_YES" == "yes" ]]; then
    echo -e "  ${CYAN}$prompt ${hint}${NC} → auto: yes"
    return 0
  fi

  local answer
  read -r -p "$(echo -e "  ${CYAN}${prompt} ${hint}${NC} ")" answer < /dev/tty
  answer="${answer:-}"
  if [[ "$default" == "default-y" ]]; then
    # Vacío o y/Y → sí
    [[ "$answer" =~ ^[YySs].*$ || -z "$answer" ]] && return 0 || return 1
  else
    # y/Y/s/S → sí, todo lo demás (incluido vacío) → no
    [[ "$answer" =~ ^[YySs].*$ ]] && return 0 || return 1
  fi
}

# -------------------------------------------------------------
# Parseo de argumentos
# -------------------------------------------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yes)
        ASSUME_YES="yes"
        ;;
      --keep-data)
        KEEP_DATA="yes"
        ;;
      --backup-dir)
        shift
        BACKUP_DIR="${1:?--backup-dir requiere un argumento}"
        ;;
      -h|--help)
        sed -n '2,15p' "${BASH_SOURCE[0]}"
        exit 0
        ;;
      *)
        die "Argumento desconocido: $1  (use -h para ayuda)"
        ;;
    esac
    shift
  done
}

# -------------------------------------------------------------
# Verificar root
# -------------------------------------------------------------
check_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    log_error "Este script debe ejecutarse como root."
    echo ""
    echo -e "  Ejecute:  ${CYAN}sudo $0${NC}"
    exit 1
  fi

  # Necesitamos el HOME del usuario real (no /var/root) para el backup
  if [[ -z "${SUDO_USER:-}" ]]; then
    log_warn "No se detectó SUDO_USER — el backup se guardará en $BACKUP_DIR"
  else
    REAL_HOME="$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6 || true)"
    if [[ -z "$REAL_HOME" ]]; then
      # macOS no tiene getent; usar dscl
      REAL_HOME="$(dscl . -read "/Users/$SUDO_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}' || true)"
    fi
    if [[ -n "$REAL_HOME" ]]; then
      # Si BACKUP_DIR sigue siendo el default (~/Desktop del root), sobreescribir
      if [[ "$BACKUP_DIR" == "${HOME}/Desktop" ]]; then
        BACKUP_DIR="$REAL_HOME/Desktop"
      fi
    fi
  fi
}

# -------------------------------------------------------------
# Detener y descargar el LaunchDaemon
# -------------------------------------------------------------
stop_service() {
  banner "Deteniendo el servicio KioskoApp"

  if sudo launchctl list 2>/dev/null | grep -q "$PLIST_LABEL"; then
    log_info "Descargando LaunchDaemon..."
    sudo launchctl unload "$PLIST_PATH" 2>/dev/null || true
    sleep 1
    if sudo launchctl list 2>/dev/null | grep -q "$PLIST_LABEL"; then
      log_warn "El servicio todavía aparece en launchctl — puede que tarde en morir."
      log_warn "Mátelo manualmente con: sudo launchctl remove $PLIST_LABEL"
    else
      log_success "Servicio detenido y descargado"
    fi
  else
    log_info "El servicio no estaba cargado — nada que detener."
  fi

  # Por seguridad, matar procesos por si el runtime script dejó hijos
  if pgrep -f "$INSTALL_DIR/kiosko-runtime.sh" > /dev/null 2>&1; then
    log_warn "Procesos huérfanos del runtime detectados — enviando SIGTERM..."
    pkill -f "$INSTALL_DIR/kiosko-runtime.sh" 2>/dev/null || true
    sleep 2
    pkill -9 -f "$INSTALL_DIR/kiosko-runtime.sh" 2>/dev/null || true
  fi
  if pgrep -f "$INSTALL_DIR/license-server" > /dev/null 2>&1; then
    log_warn "License-server todavía corriendo — enviando SIGTERM..."
    pkill -f "$INSTALL_DIR/license-server" 2>/dev/null || true
    sleep 1
    pkill -9 -f "$INSTALL_DIR/license-server" 2>/dev/null || true
  fi
  if pgrep -f "$INSTALL_DIR/app/server.js" > /dev/null 2>&1; then
    log_warn "Servidor Next.js todavía corriendo — enviando SIGTERM..."
    pkill -f "$INSTALL_DIR/app/server.js" 2>/dev/null || true
    sleep 1
    pkill -9 -f "$INSTALL_DIR/app/server.js" 2>/dev/null || true
  fi
}

# -------------------------------------------------------------
# Eliminar el plist
# -------------------------------------------------------------
remove_plist() {
  banner "Eliminando plist del LaunchDaemon"

  if [[ -f "$PLIST_PATH" ]]; then
    rm -f "$PLIST_PATH"
    log_success "Plist eliminado: $PLIST_PATH"
  else
    log_info "No existe $PLIST_PATH — omitiendo."
  fi
}

# -------------------------------------------------------------
# Backup opcional de la base de datos
# -------------------------------------------------------------
backup_db() {
  banner "Backup de la base de datos"

  # Verificar que hay algo que respaldar
  local has_db="no"
  [[ -f "$DB_PATH" ]] && has_db="yes"
  [[ -f "$LICENSE_DB_PATH" ]] && has_db="yes"

  if [[ "$has_db" == "no" ]]; then
    log_info "No se encontraron bases de datos — omitiendo backup."
    return 0
  fi

  if confirm "¿Hacer backup de la DB antes de borrarla?" "default-y"; then
    # Asegurar que la carpeta de backup existe
    mkdir -p "$BACKUP_DIR" 2>/dev/null || true
    if [[ ! -d "$BACKUP_DIR" ]]; then
      log_error "No se pudo crear/acceder a la carpeta de backup: $BACKUP_DIR"
      log_error "Saltando backup. La DB se perderá si elige borrar /Applications/KioskoApp."
      return 1
    fi

    local stamp file_app file_license
    stamp="$(date +%Y%m%d)"
    file_app="$BACKUP_DIR/kioskoapp-backup-$stamp.db"
    file_license="$BACKUP_DIR/kioskoapp-license-server-backup-$stamp.db"

    local count=0
    if [[ -f "$DB_PATH" ]]; then
      # Usar sqlite3 .backup para snapshot consistente (si está sqlite3 CLI)
      if command -v sqlite3 &> /dev/null; then
        sqlite3 "$DB_PATH" ".backup '$file_app'" 2>/dev/null || cp "$DB_PATH" "$file_app"
      else
        cp "$DB_PATH" "$file_app"
      fi
      chown "${SUDO_USER:-root}:staff" "$file_app" 2>/dev/null || true
      log_success "DB app respaldada: $file_app ($(du -h "$file_app" | cut -f1))"
      count=$((count + 1))
    fi
    if [[ -f "$LICENSE_DB_PATH" ]]; then
      if command -v sqlite3 &> /dev/null; then
        sqlite3 "$LICENSE_DB_PATH" ".backup '$file_license'" 2>/dev/null || cp "$LICENSE_DB_PATH" "$file_license"
      else
        cp "$LICENSE_DB_PATH" "$file_license"
      fi
      chown "${SUDO_USER:-root}:staff" "$file_license" 2>/dev/null || true
      log_success "DB license-server respaldada: $file_license ($(du -h "$file_license" | cut -f1))"
      count=$((count + 1))
    fi

    if [[ $count -eq 0 ]]; then
      log_warn "No se respaldó ninguna DB (¿archivos inaccesibles?)."
    fi
  else
    log_warn "No se hará backup. Si borra /Applications/KioskoApp, las DBs se perderán."
  fi
}

# -------------------------------------------------------------
# Eliminar /Applications/KioskoApp (con confirmación)
# -------------------------------------------------------------
remove_install_dir() {
  banner "Eliminando $INSTALL_DIR"

  if [[ ! -d "$INSTALL_DIR" ]]; then
    log_info "$INSTALL_DIR no existe — nada que borrar."
    return 0
  fi

  if [[ "$KEEP_DATA" == "yes" ]]; then
    log_info "--keep-data: NO se borrará $INSTALL_DIR"
    log_info "Solo se detuvo el servicio y se eliminó el plist."
    return 0
  fi

  # Doble confirmación — esto es destructivo
  echo ""
  echo -e "  ${YELLOW}⚠  ESTA ACCIÓN ES IRREVERSIBLE${NC}"
  echo -e "  Se borrará completamente:  ${CYAN}$INSTALL_DIR${NC}"
  echo -e "  Incluye: app/, license-server, prisma/, data/, keys/, logs/, kiosko.env"
  echo -e "  Las claves Ed25519 en keys/private.pem NO se pueden regenerar"
  echo -e "  (licencias emitidas con esa clave dejarán de ser verificables)."
  echo ""

  if confirm "¿Está SEGURO de borrar $INSTALL_DIR?" "default-n"; then
    # Triple confirmación si hay claves privadas (muy destructivo)
    if [[ -f "$INSTALL_DIR/keys/private.pem" ]]; then
      echo ""
      echo -e "  ${RED}⚠  Se detectó keys/private.pem (clave maestra de licencias).${NC}"
      echo -e "  ${RED}   Borrarla invalida TODAS las licencias emitidas.${NC}"
      if ! confirm "¿Borrar también la clave privada?" "default-n"; then
        log_info "Preservando keys/ — copiándola a $BACKUP_DIR antes de borrar el resto..."
        mkdir -p "$BACKUP_DIR/kioskoapp-keys-backup-$(date +%Y%m%d)" 2>/dev/null || true
        cp -r "$INSTALL_DIR/keys" "$BACKUP_DIR/kioskoapp-keys-backup-$(date +%Y%m%d)/" 2>/dev/null || true
        chown -R "${SUDO_USER:-root}:staff" "$BACKUP_DIR/kioskoapp-keys-backup-"* 2>/dev/null || true
        log_success "Claves respaldadas en $BACKUP_DIR/kioskoapp-keys-backup-$(date +%Y%m%d)/"
        # Borrar todo excepto keys/
        find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name 'keys' -exec rm -rf {} +
        log_success "Borrado todo excepto $INSTALL_DIR/keys/ (preservado)"
        return 0
      fi
    fi

    rm -rf "$INSTALL_DIR"
    log_success "$INSTALL_DIR eliminado completamente"
  else
    log_info "No se borró $INSTALL_DIR — el directorio sigue presente."
    log_info "Puede borrarlo manualmente con: sudo rm -rf $INSTALL_DIR"
  fi
}

# -------------------------------------------------------------
# Banner final
# -------------------------------------------------------------
final_banner() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅  Desinstalación de KioskoApp completada                  ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "  ${YELLOW}Se preservó:${NC} $INSTALL_DIR"
  else
    echo -e "  ${GREEN}Eliminado:${NC} $INSTALL_DIR"
  fi
  if [[ -f "$PLIST_PATH" ]]; then
    echo -e "  ${YELLOW}Se preservó:${NC} $PLIST_PATH"
  else
    echo -e "  ${GREEN}Eliminado:${NC} $PLIST_PATH"
  fi
  echo ""
  echo -e "  Para reinstalar:  ${CYAN}./scripts/install-macos.sh${NC}"
  echo ""
}

# -------------------------------------------------------------
# Main
# -------------------------------------------------------------
main() {
  parse_args "$@"
  banner "KioskoApp — Desinstalador para macOS"
  echo -e "  ${CYAN}Esto detendrá el servicio y (opcionalmente) borrará los archivos.${NC}"
  if [[ "$ASSUME_YES" == "yes" ]]; then
    echo -e "  ${YELLOW}Modo no-interactivo (-y): se asumirá 'sí' a todas las confirmaciones.${NC}"
  fi

  check_root
  stop_service
  remove_plist

  # Solo ofrecer backup/borrado si el directorio existe
  if [[ -d "$INSTALL_DIR" ]]; then
    backup_db || true
    remove_install_dir
  else
    log_info "$INSTALL_DIR no existe — nada más que hacer."
  fi

  final_banner
}

main "$@"
