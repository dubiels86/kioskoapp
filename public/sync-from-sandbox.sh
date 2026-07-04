#!/usr/bin/env bash
#
# sync-from-sandbox.sh — Sincroniza el repo local de KioskoApp con los cambios
# del sandbox y los sube a GitHub.
#
# Uso:
#   1) Descargá desde el sandbox dos archivos:
#        - kiosko-src-snapshot.tar.gz  (código fuente actualizado)
#        - sync-from-sandbox.sh        (este script)
#        Podés hacerlo desde la UI del panel de vista previa con el botón
#        "Descargar Proyecto", o directamente con curl/wget desde la URL
#        pública del sandbox.
#   2) Colocá ambos archivos en la RAÍZ de tu repo local de KioskoApp
#      (la carpeta que tiene .git/, src/, package.json).
#   3) Dales permisos de ejecución y corré el script:
#        chmod +x sync-from-sandbox.sh
#        ./sync-from-sandbox.sh
#
# Qué hace:
#   - Verifica que estás en un repo git limpio (sin cambios sin commitear)
#   - Crea un branch de backup por las dudas
#   - Descomprime el tar.gz encima del repo local (sobrescribe src/, scripts/,
#     prisma/, mini-services/license-server/, public/ y configs raíz)
#   - Hace git add + commit con mensaje descriptivo
#   - Hace git push origin main  (acá sí te va a pedir tus credenciales de
#     GitHub, pero como es tu PC local ya las tenés configuradas)
#
# Si algo sale mal, podés volver atrás con:
#   git reset --hard <backup-branch>
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuración
# -----------------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARBALL="kiosko-src-snapshot.tar.gz"
BACKUP_BRANCH="backup/pre-sync-$(date +%Y%m%d-%H%M%S)"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN:${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; }
step() { echo -e "\n${CYAN}▶ $*${NC}"; }

# -----------------------------------------------------------------------------
# 0. Checks iniciales
# -----------------------------------------------------------------------------
step "Verificando entorno..."

cd "$REPO_DIR"

if [[ ! -d .git ]]; then
  err "No estás en un repo git. Ejecutá este script desde la raíz del repo KioskoApp local."
  exit 1
fi

if [[ ! -f "$TARBALL" ]]; then
  err "No encuentro $TARBALL en $(pwd)."
  err "Descargalo del sandbox y colocalo acá antes de ejecutar este script."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  err "git no está instalado. Instalalo con: sudo apt install git  (o brew install git)"
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
log "Repo:        $REPO_DIR"
log "Branch:      $CURRENT_BRANCH"
log "Tarball:     $TARBALL ($(du -h "$TARBALL" | cut -f1))"
log "Remote:      $REMOTE / $BRANCH"

# -----------------------------------------------------------------------------
# 1. Verificar que el repo local está limpio
# -----------------------------------------------------------------------------
step "Verificando estado del repo local..."

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Tenés cambios sin commitear en el repo local:"
  git status --short
  echo ""
  warn "Hacé commit o stash de estos cambios antes de correr el sync,"
  warn "o este script los va a sobrescribir."
  echo ""
  read -r -p "¿Continuar igualmente? (escribí SI para confirmar): " resp
  if [[ "$resp" != "SI" ]]; then
    log "Abortado por el usuario."
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
# 2. Crear branch de backup
# -----------------------------------------------------------------------------
step "Creando branch de backup: $BACKUP_BRANCH..."

git branch "$BACKUP_BRANCH" 2>/dev/null || {
  warn "No se pudo crear el branch de backup (¿ya existe?). Continuando igualmente."
}
log "Backup creado. Si algo sale mal, podés volver con:"
log "  git reset --hard $BACKUP_BRANCH"

# -----------------------------------------------------------------------------
# 3. Descomprimir el tarball encima del repo
# -----------------------------------------------------------------------------
step "Descomprimiendo $TARBALL..."

# El tarball NO tiene prefijo de carpeta raíz (se creó con --transform='s,^,kiosko-app/,')
# Verificamos primero si tiene prefijo
if tar -tzf "$TARBALL" | head -1 | grep -q '^kiosko-app/'; then
  log "Tarball tiene prefijo 'kiosko-app/', extrayendo con --strip-components=1..."
  tar -xzf "$TARBALL" --strip-components=1
else
  log "Tarball sin prefijo, extrayendo directamente..."
  tar -xzf "$TARBALL"
fi

log "Archivos descomprimidos."

# -----------------------------------------------------------------------------
# 4. Mostrar qué cambió
# -----------------------------------------------------------------------------
step "Resumen de cambios detectados por git:"

CHANGES="$(git status --porcelain | wc -l)"
log "Total de archivos modificados/nuevos: $CHANGES"
git status --short | head -30
if [[ $CHANGES -gt 30 ]]; then
  log "... y $((CHANGES - 30)) más"
fi

if [[ $CHANGES -eq 0 ]]; then
  warn "No hay cambios respecto al último commit. Nada que commitear."
  log "Eliminando el tarball..."
  rm -f "$TARBALL"
  exit 0
fi

# -----------------------------------------------------------------------------
# 5. Commit
# -----------------------------------------------------------------------------
step "Haciendo commit..."

COMMIT_MSG="sync: actualizar desde sandbox ($(date +%Y-%m-%d %H:%M))

Incluye:
- Sistema de licencia L1+L2+L3 (Ed25519 + fingerprint + heartbeat + grace)
- License-server mini-servicio en mini-services/license-server/
- Migración middleware.ts → proxy.ts (convención Next.js 16)
- Panel admin de licencias en Ajustes > Licencias
- Telemetría silenciosa + cookie HMAC firmada"

git add -A
git commit -m "$COMMIT_MSG"
log "Commit creado: $(git log --oneline -1)"

# -----------------------------------------------------------------------------
# 6. Push a GitHub
# -----------------------------------------------------------------------------
step "Haciendo push a $REMOTE/$BRANCH..."

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  err "No existe el remote '$REMOTE'. Crealo con:"
  err "  git remote add origin https://github.com/dubiels86/kioskoapp.git"
  exit 1
fi

REMOTE_URL="$(git remote get-url "$REMOTE")"
log "Remote URL: $REMOTE_URL"

if git push "$REMOTE" "$BRANCH"; then
  echo ""
  step "✅ ¡Sincronización completa!"
  log "Cambios subidos a $REMOTE/$BRANCH"
  log "Branch de backup local: $BACKUP_BRANCH"
  log ""
  log "Si querés limpiar el branch de backup (cuando confirmes que todo anda):"
  log "  git branch -D $BACKUP_BRANCH"
else
  err "El push falló. Probablemente necesites autenticarte en GitHub."
  err "El commit quedó en tu repo local. Para reintentar el push:"
  err "  git push $REMOTE $BRANCH"
  err ""
  err "Si tu remote es HTTPS, GitHub te va a pedir usuario + Personal Access Token."
  err "Si querés usar SSH en tu PC local:"
  err "  git remote set-url $REMOTE git@github.com:dubiels86/kioskoapp.git"
  exit 1
fi

# -----------------------------------------------------------------------------
# 7. Limpieza
# -----------------------------------------------------------------------------
rm -f "$TARBALL"
log "Tarball eliminado del repo local."

echo ""
log "Listo. Tu repo local y GitHub están actualizados con los cambios del sandbox."
