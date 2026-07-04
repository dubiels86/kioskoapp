#!/bin/bash
# =============================================================
# KioskoApp — Instalador para macOS
# =============================================================
# Instala KioskoApp (Next.js 16 POS + Inventory + license-server)
# en /Applications/KioskoApp y configura un LaunchDaemon para que
# arranque automáticamente con el sistema.
#
# Uso:
#   1. Descomprimir kioskoapp-installer.tar.gz
#   2. cd a la carpeta descomprimida
#   3. ./scripts/install-macos.sh
#
# Requiere: macOS, Node.js, Bun, openssl (todos verificables).
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
# Rutas (constantes)
# -------------------------------------------------------------
INSTALL_DIR="/Applications/KioskoApp"
APP_DIR="$INSTALL_DIR/app"
PRISMA_DIR="$INSTALL_DIR/prisma"
DATA_DIR="$INSTALL_DIR/data"
KEYS_DIR="$INSTALL_DIR/keys"
LOGS_DIR="$INSTALL_DIR/logs"
ENV_FILE="$INSTALL_DIR/kiosko.env"
RUNTIME_SCRIPT="$INSTALL_DIR/kiosko-runtime.sh"
LICENSE_SERVER_BIN="$INSTALL_DIR/license-server"
DB_PATH="$DATA_DIR/custom.db"
LICENSE_DB_PATH="$DATA_DIR/license-server.db"
PLIST_PATH="/Library/LaunchDaemons/com.kioskoapp.plist"
PLIST_LABEL="com.kioskoapp"

# Capturar rutas absolutas a binarios ANTES de cualquier sudo
BUN_BIN="$(command -v bun || true)"
NODE_BIN="$(command -v node || true)"

# PID del refrescador de sudo (para limpieza al salir)
SUDO_REFRESH_PID=""

# -------------------------------------------------------------
# Helpers de logging
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

cleanup() {
  if [[ -n "$SUDO_REFRESH_PID" ]]; then
    kill "$SUDO_REFRESH_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# -------------------------------------------------------------
# Paso 1: Verificaciones de preflicht
# -------------------------------------------------------------
preflight() {
  banner "Paso 1/8 — Verificando requisitos del sistema"

  # macOS
  if [[ "$(uname -s)" != "Darwin" ]]; then
    die "Este instalador es para macOS únicamente (detectado: $(uname -s)). Use el instalador correspondiente en Linux."
  fi
  log_success "macOS detectado: $(sw_vers -productVersion)"

  # Node.js
  if [[ -z "$NODE_BIN" ]]; then
    log_error "Node.js no está instalado."
    echo ""
    echo -e "  Instale con Homebrew:"
    echo -e "    ${CYAN}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}"
    echo -e "    ${CYAN}brew install node${NC}"
    echo ""
    echo -e "  O descargue el instalador desde https://nodejs.org/"
    exit 1
  fi
  log_success "Node.js: $($NODE_BIN --version)  ($NODE_BIN)"

  # Bun
  if [[ -z "$BUN_BIN" ]]; then
    log_error "Bun no está instalado."
    echo ""
    echo -e "  Instale con:"
    echo -e "    ${CYAN}curl -fsSL https://bun.sh/install | bash${NC}"
    echo -e "  Luego recargue su shell:"
    echo -e "    ${CYAN}source ~/.zshrc${NC}   (o ~/.bashrc)"
    echo -e "  Y vuelva a ejecutar este instalador."
    exit 1
  fi
  log_success "Bun: $($BUN_BIN --version)  ($BUN_BIN)"

  # openssl (para claves Ed25519)
  if ! command -v openssl &> /dev/null; then
    die "openssl no está instalado (necesario para generar claves Ed25519)."
  fi
  log_success "openssl: $(openssl version)"

  # rsync (para copiar la app eficientemente)
  if ! command -v rsync &> /dev/null; then
    die "rsync no está instalado (necesario para copiar archivos). En macOS debería estar presente por defecto."
  fi
  log_success "rsync disponible"

  # launchctl (siempre presente en macOS, pero verificamos)
  if ! command -v launchctl &> /dev/null; then
    die "launchctl no está disponible (¿esto realmente es macOS?)."
  fi
}

# -------------------------------------------------------------
# Paso 2: Solicitar sudo y mantenerlo activo
# -------------------------------------------------------------
ensure_sudo() {
  banner "Paso 2/8 — Solicitando permisos de administrador"
  log_info "Se necesitan permisos de administrador (sudo) para:"
  log_info "  • Escribir en /Applications/KioskoApp"
  log_info "  • Crear /Library/LaunchDaemons/com.kioskoapp.plist"
  log_info "  • Cargar el servicio en launchctl"
  echo ""

  # sudo -v pide contraseña si el timestamp expiró
  if ! sudo -v; then
    die "No se obtuvieron permisos de administrador. Cancele e intente de nuevo con un usuario admin."
  fi

  # Refrescar sudo en background cada 60s para que no expire durante la instalación
  ( while true; do sudo -n true 2>/dev/null || true; sleep 60; done ) &
  SUDO_REFRESH_PID=$!

  log_success "Permisos de administrador confirmados"
}

# -------------------------------------------------------------
# Paso 3: Detectar el directorio fuente (tarball descomprimido)
# -------------------------------------------------------------
detect_source() {
  banner "Paso 3/8 — Detectando archivos de instalación"

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Buscar el directorio que contiene app/, license-server y prisma/schema.prisma.
  # Probamos primero el mismo directorio del script y luego el padre.
  SOURCE_DIR=""
  local candidate
  for candidate in "$script_dir" "$script_dir/.."; do
    if [[ -d "$candidate/app" \
          && -f "$candidate/license-server" \
          && -f "$candidate/prisma/schema.prisma" \
          && -f "$candidate/scripts/kiosko-runtime.sh" ]]; then
      SOURCE_DIR="$(cd "$candidate" && pwd)"
      break
    fi
  done

  if [[ -z "$SOURCE_DIR" ]]; then
    log_error "No se encontraron los archivos del tarball."
    echo ""
    echo -e "  Se esperaba encontrar estos archivos en el mismo directorio"
    echo -e "  del script o en su directorio padre:"
    echo -e "    ${CYAN}app/${NC}                     (build standalone de Next.js)"
    echo -e "    ${CYAN}license-server${NC}           (binario compilado de Bun)"
    echo -e "    ${CYAN}prisma/schema.prisma${NC}     (esquema de base de datos)"
    echo -e "    ${CYAN}scripts/kiosko-runtime.sh${NC} (arranque de servicios)"
    echo ""
    echo -e "  Asegúrese de ejecutar este script desde DENTRO del tarball"
    echo -e "  descomprimido (típicamente: ${CYAN}./scripts/install-macos.sh${NC})."
    exit 1
  fi

  log_success "Directorio fuente detectado: $SOURCE_DIR"
}

# -------------------------------------------------------------
# Paso 4: Copiar archivos a /Applications/KioskoApp
# -------------------------------------------------------------
copy_files() {
  banner "Paso 4/8 — Copiando archivos a $INSTALL_DIR"

  # Crear estructura de directorios
  sudo mkdir -p "$APP_DIR" "$PRISMA_DIR" "$DATA_DIR" "$KEYS_DIR" "$LOGS_DIR"

  # app/ (Next.js standalone: server.js + .next + public + node_modules)
  log_info "Copiando app/ (build de Next.js — puede tardar un minuto)..."
  sudo rsync -a --delete \
    --exclude '.git' --exclude '*.log' --exclude '.DS_Store' \
    "$SOURCE_DIR/app/" "$APP_DIR/"
  log_success "app/ copiado"

  # license-server (binario compilado)
  log_info "Copiando binario license-server..."
  sudo cp "$SOURCE_DIR/license-server" "$LICENSE_SERVER_BIN"
  sudo chmod 755 "$LICENSE_SERVER_BIN"
  log_success "license-server copiado (ejecutable)"

  # prisma/schema.prisma
  sudo cp "$SOURCE_DIR/prisma/schema.prisma" "$PRISMA_DIR/schema.prisma"
  log_success "prisma/schema.prisma copiado"

  # kiosko-runtime.sh
  log_info "Copiando kiosko-runtime.sh..."
  sudo cp "$SOURCE_DIR/scripts/kiosko-runtime.sh" "$RUNTIME_SCRIPT"
  sudo chmod 755 "$RUNTIME_SCRIPT"
  log_success "kiosko-runtime.sh copiado (ejecutable)"

  # Copiar README si existe
  if [[ -f "$SOURCE_DIR/README-INSTALACION.txt" ]]; then
    sudo cp "$SOURCE_DIR/README-INSTALACION.txt" "$INSTALL_DIR/README-INSTALACION.txt"
    log_success "README-INSTALACION.txt copiado"
  fi

  # Permisos: root:admin, lectura/escritura para admin group
  sudo chown -R root:admin "$INSTALL_DIR"
  sudo chmod -R u+rwX,g+rwX,o+rX "$INSTALL_DIR"
  log_success "Permisos aplicados (root:admin)"
}

# -------------------------------------------------------------
# Paso 5: Generar par de claves Ed25519
# -------------------------------------------------------------
generate_keys() {
  banner "Paso 5/8 — Generando par de claves Ed25519"

  # Clave privada (solo si no existe — preservar en reinstalaciones)
  if [[ -f "$KEYS_DIR/private.pem" ]]; then
    log_warn "Ya existe $KEYS_DIR/private.pem — NO se regenera (se preserva la clave existente)."
  else
    log_info "Generando clave privada Ed25519 con openssl..."
    sudo openssl genpkey -algorithm Ed25519 -out "$KEYS_DIR/private.pem"
    sudo chmod 600 "$KEYS_DIR/private.pem"
    sudo chown root:admin "$KEYS_DIR/private.pem"
    log_success "Clave privada generada: $KEYS_DIR/private.pem"
  fi

  # Clave pública en formato SPKI PEM (la que usa el cliente para verificar firmas)
  log_info "Extrayendo clave pública SPKI PEM..."
  sudo openssl pkey -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"
  sudo chmod 644 "$KEYS_DIR/public.pem"
  sudo chown root:admin "$KEYS_DIR/public.pem"
  log_success "Clave pública generada: $KEYS_DIR/public.pem"

  # Copiar la clave pública a las ubicaciones donde src/lib/license.ts la busca.
  # license.ts prueba (relativo a process.cwd()):
  #   1. src/lib/license-public-key.pem   ← ruta canónica del repo
  #   2. lib/license-public-key.pem
  #   3. license-public-key.pem            ← raíz del cwd (fallback)
  # El runtime script hace cd a app/, así que cwd = /Applications/KioskoApp/app.
  # Ponemos la clave en las dos rutas más seguras.
  sudo mkdir -p "$APP_DIR/src/lib"
  sudo cp "$KEYS_DIR/public.pem" "$APP_DIR/src/lib/license-public-key.pem"
  sudo cp "$KEYS_DIR/public.pem" "$APP_DIR/license-public-key.pem"
  log_success "Clave pública copiada a app/src/lib/license-public-key.pem"
  log_success "Clave pública copiada a app/license-public-key.pem (fallback)"
}

# -------------------------------------------------------------
# Paso 6: Crear kiosko.env con variables de entorno
# -------------------------------------------------------------
create_env() {
  banner "Paso 6/8 — Creando kiosko.env"

  # Generar secretos aleatorios (32 y 64 hex chars)
  local admin_key cookie_secret
  admin_key="$(openssl rand -hex 16)"      # 32 hex chars
  cookie_secret="$(openssl rand -hex 32)"  # 64 hex chars

  # Si ya existe un kiosko.env, respaldarlo
  if [[ -f "$ENV_FILE" ]]; then
    sudo cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
    log_warn "kiosko.env existía — se respaldó como $ENV_FILE.bak.*"
  fi

  # Escribir el archivo (sudo tee para permisos root)
  sudo tee "$ENV_FILE" > /dev/null <<EOF
# =============================================================
# KioskoApp — Configuración de entorno
# =============================================================
# Generado por install-macos.sh el $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# NO expongas este archivo. Contiene secretos.
# =============================================================

# --- Base de datos (SQLite para la app Next.js) ---
DATABASE_URL=file:$DB_PATH

# --- Servidor Next.js (standalone) ---
PORT=3000
NODE_ENV=production
HOSTNAME=0.0.0.0

# --- License-server (mini-servicio Bun en puerto 3042) ---
LICENSE_SERVER_URL=http://localhost:3042

# IMPORTANTE sobre ADMIN_API_KEY / LICENSE_ADMIN_API_KEY:
#   El binario 'license-server' tiene la clave de admin HARDCODED como
#   'kiosko-admin-secret-2025' (constante en index.ts al compilar).
#   Para que el panel super-admin de la app pueda hablar con el
#   license-server, AMBOS lados deben usar la MISMA clave.
#   Por eso LICENSE_ADMIN_API_KEY aquí coincide con el valor del binario.
#   Si recompilas el binario con otra clave, actualiza esta variable.
LICENSE_ADMIN_API_KEY=kiosko-admin-secret-2025

# Clave de admin genérica (puede usarse para integraciones futuras).
# Generada aleatoriamente en cada instalación.
ADMIN_API_KEY=$admin_key

# --- Cookie de licencia (HMAC-SHA256 en middleware Edge) ---
# Rotar en producción. Si cambia, todas las sesiones activas se invalidan.
LICENSE_COOKIE_SECRET=$cookie_secret
EOF

  sudo chown root:admin "$ENV_FILE"
  sudo chmod 600 "$ENV_FILE"
  log_success "kiosko.env creado en $ENV_FILE (permisos 600, root:admin)"
}

# -------------------------------------------------------------
# Paso 7: Inicializar base de datos SQLite + seed super-admin
# -------------------------------------------------------------
init_db() {
  banner "Paso 7/8 — Inicializando base de datos SQLite"

  # Asegurar que el archivo DB existe y tiene permisos correctos
  sudo touch "$DB_PATH"
  sudo chown root:admin "$DB_PATH"
  sudo chmod 664 "$DB_PATH"
  log_success "DB de la app: $DB_PATH"

  # El binario license-server busca 'data.db' junto a sí mismo
  # (path.resolve(import.meta.dir, 'data.db') en index.ts).
  # Para honrar el layout data/license-server.db, creamos un symlink:
  #   /Applications/KioskoApp/data.db -> data/license-server.db
  # SQLite sigue el symlink y crea -wal/-shm junto al target (en data/).
  if [[ ! -e "$LICENSE_DB_PATH" ]]; then
    sudo touch "$LICENSE_DB_PATH"
    sudo chown root:admin "$LICENSE_DB_PATH"
    sudo chmod 664 "$LICENSE_DB_PATH"
  fi
  if [[ ! -e "$INSTALL_DIR/data.db" && ! -L "$INSTALL_DIR/data.db" ]]; then
    # Crear symlink relativo para que funcione aunque se mueva el directorio
    sudo ln -s "data/license-server.db" "$INSTALL_DIR/data.db"
    log_success "Symlink $INSTALL_DIR/data.db -> data/license-server.db"
  fi
  log_success "DB del license-server: $LICENSE_DB_PATH (vía symlink)"

  # --- prisma db push: crea tablas y genera el cliente Prisma ---
  # Usamos 'sudo env VAR=...' porque macOS sudo por defecto NO permite
  # 'sudo VAR=... cmd' (setenv deshabilitado). 'env' siempre funciona.
  log_info "Ejecutando 'prisma db push' (crea tablas, puede descargar prisma CLI)..."
  if ! sudo env DATABASE_URL="file:$DB_PATH" "$BUN_BIN" x prisma db push \
        --schema "$PRISMA_DIR/schema.prisma" \
        --accept-data-loss 2>&1 | tail -15; then
    die "prisma db push falló. Revise el esquema en $PRISMA_DIR/schema.prisma y que DATABASE_URL sea escribible."
  fi
  log_success "Esquema de base de datos aplicado correctamente"

  # --- Seed: crear rol Super Administrador + usuario dubiel/admin ---
  log_info "Creando usuario super-admin (dubiel / admin)..."
  seed_super_admin
  log_success "Super-admin creado/verificado"
}

# -------------------------------------------------------------
# Sub-paso 7b: Seed del super-admin (rol + usuario dubiel/admin)
# -------------------------------------------------------------
# Escribe un script TS dentro de app/ para que 'bun' resuelva bcryptjs
# desde app/node_modules (incluido en el build standalone).
seed_super_admin() {
  local seed_script="$APP_DIR/seed-super-admin.ts"

  sudo tee "$seed_script" > /dev/null <<'TS'
/**
 * Seed del Super Administrador — ejecutado por install-macos.sh
 * Crea o actualiza el rol "Super Administrador" (todos los permisos)
 * y el usuario "dubiel" con contraseña "admin".
 *
 * Uso:  cd /Applications/KioskoApp/app
 *       KIOSKO_DB_PATH=/Applications/KioskoApp/data/custom.db \
 *         bun seed-super-admin.ts
 */
import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'

const DB_PATH = process.env.KIOSKO_DB_PATH
if (!DB_PATH) {
  console.error('ERROR: KIOSKO_DB_PATH no está definida en el entorno.')
  process.exit(1)
}

const ALL_PERMISSIONS = [
  'pos.access', 'pos.refund',
  'inventory.access', 'inventory.manage',
  'purchases.access', 'purchases.manage',
  'expenses.access', 'expenses.manage',
  'cash.access', 'cash.open', 'cash.close',
  'repairs.access', 'repairs.manage',
  'reports.access',
  'settings.access', 'settings.users', 'settings.roles', 'settings.all',
]

const ROLE_NAME = 'Super Administrador'
const ROLE_DESC = 'Acceso total al sistema - Super Administrador'
const USERNAME = 'dubiel'
const PASSWORD = 'admin'
const USER_NAME = 'Dubiel'
const USER_EMAIL = 'dubiel@kioskoapp.com'

// --- Hash bcrypt de la contraseña ---
// Importamos bcryptjs desde app/node_modules (incluido en el build standalone
// porque src/lib/auth.ts lo importa).
let hashPassword: (pw: string) => string
try {
  const bcrypt = await import('bcryptjs')
  hashPassword = (pw: string) => bcrypt.hashSync(pw, 10)
} catch (e) {
  console.error('ERROR: No se pudo importar bcryptjs desde app/node_modules.')
  console.error('       Verifique que el build standalone incluya bcryptjs.')
  console.error('       Detalle:', (e as Error).message)
  process.exit(2)
}

// --- Abrir DB ---
const db = new Database(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

const now = "datetime('now')"

// --- Upsert rol ---
const existingRole = db.query('SELECT id FROM Role WHERE name = ?').get(ROLE_NAME) as { id?: string } | undefined
let roleId: string
if (existingRole?.id) {
  roleId = existingRole.id
  db.query(`UPDATE Role SET permissions = ?, description = ?, isActive = 1, updatedAt = ${now} WHERE id = ?`)
    .run(JSON.stringify(ALL_PERMISSIONS), ROLE_DESC, roleId)
  console.log(`  ✓ Rol "${ROLE_NAME}" actualizado (${ALL_PERMISSIONS.length} permisos)`)
} else {
  roleId = randomUUID()
  db.query(`INSERT INTO Role (id, name, description, permissions, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ${now}, ${now})`)
    .run(roleId, ROLE_NAME, ROLE_DESC, JSON.stringify(ALL_PERMISSIONS))
  console.log(`  ✓ Rol "${ROLE_NAME}" creado (${ALL_PERMISSIONS.length} permisos)`)
}

// --- Upsert usuario ---
const hashedPassword = hashPassword(PASSWORD)
const existingUser = db.query('SELECT id FROM User WHERE username = ?').get(USERNAME) as { id?: string } | undefined
if (existingUser?.id) {
  db.query(`UPDATE User SET password = ?, name = ?, email = ?, roleId = ?, isActive = 1, updatedAt = ${now} WHERE id = ?`)
    .run(hashedPassword, USER_NAME, USER_EMAIL, roleId, existingUser.id)
  console.log(`  ✓ Usuario "${USERNAME}" actualizado (rol: ${ROLE_NAME})`)
} else {
  db.query(`INSERT INTO User (id, username, password, name, email, roleId, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ${now}, ${now})`)
    .run(randomUUID(), USERNAME, hashedPassword, USER_NAME, USER_EMAIL, roleId)
  console.log(`  ✓ Usuario "${USERNAME}" creado (rol: ${ROLE_NAME})`)
}

// --- Verificación ---
const verify = db.query('SELECT u.id, u.username, u.isActive, r.name as roleName FROM User u JOIN Role r ON u.roleId = r.id WHERE u.username = ?').get(USERNAME) as { id: string, username: string, isActive: number, roleName: string } | undefined
if (verify && verify.isActive === 1 && verify.roleName === ROLE_NAME) {
  console.log('  ✓ Verificación OK')
} else {
  console.error('  ✗ Verificación FALLÓ — revise la base de datos manualmente')
  process.exit(3)
}

console.log('SEED OK')
TS

  sudo chown root:admin "$seed_script"
  sudo chmod 644 "$seed_script"

  # El script vive en $APP_DIR/seed-super-admin.ts, así que Bun resuelve
  # 'bcryptjs' desde $APP_DIR/node_modules/ (incluido en el build standalone).
  # 'sudo env VAR=...' porque macOS sudo no permite 'sudo VAR=... cmd' directo.
  if ! sudo env KIOSKO_DB_PATH="$DB_PATH" "$BUN_BIN" "$seed_script" 2>&1 | tail -10; then
    die "El seed del super-admin falló. Puede reintentar manualmente con:\n  cd $APP_DIR && sudo env KIOSKO_DB_PATH=$DB_PATH $BUN_BIN $seed_script"
  fi
}

# -------------------------------------------------------------
# Paso 8: Configurar LaunchDaemon (autoarranque en boot)
# -------------------------------------------------------------
setup_launchd() {
  banner "Paso 8/8 — Configurando LaunchDaemon (autoarranque)"

  # Descargar si ya está cargado (para reinstalaciones)
  sudo launchctl unload "$PLIST_PATH" 2>/dev/null || true

  # Construir PATH para el plist (incluye ubicaciones típicas de bun y node)
  local bun_dir node_dir
  bun_dir="$(dirname "$BUN_BIN")"
  node_dir="$(dirname "$NODE_BIN")"
  local path_env="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${bun_dir}:${node_dir}"

  # Crear el plist
  sudo tee "$PLIST_PATH" > /dev/null <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${RUNTIME_SCRIPT}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${path_env}</string>
        <key>HOME</key>
        <string>/var/root</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>${LOGS_DIR}/launchd.out.log</string>

    <key>StandardErrorPath</key>
    <string>${LOGS_DIR}/launchd.err.log</string>
</dict>
</plist>
EOF

  sudo chown root:wheel "$PLIST_PATH"
  sudo chmod 644 "$PLIST_PATH"
  log_success "Plist creado: $PLIST_PATH (root:wheel, 644)"

  # Cargar y arrancar
  sudo launchctl load -w "$PLIST_PATH"
  log_success "LaunchDaemon cargado y arrancado"

  # Esperar y verificar que el proceso está vivo
  log_info "Esperando 3 segundos a que el servicio arranque..."
  sleep 3
  if sudo launchctl list | grep -q "$PLIST_LABEL"; then
    log_success "Servicio activo en launchctl"
  else
    log_warn "El servicio no aparece en launchctl todavía — revise los logs:"
    log_warn "  sudo tail -f $LOGS_DIR/launchd.err.log"
  fi
}

# -------------------------------------------------------------
# Banner final con instrucciones
# -------------------------------------------------------------
final_banner() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}║   ✅  KioskoApp se instaló correctamente en macOS             ║${NC}"
  echo -e "${GREEN}║                                                               ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}📍 Ubicación de instalación:${NC}"
  echo -e "   $INSTALL_DIR"
  echo ""
  echo -e "${BOLD}🌐 URLs del servicio:${NC}"
  echo -e "   App (POS + Inventario):  ${CYAN}http://localhost:3000${NC}"
  echo -e "   License-server (health): ${CYAN}http://localhost:3042/api/health${NC}"
  echo ""
  echo -e "${BOLD}🔑 Credenciales super-admin:${NC}"
  echo -e "   Usuario:     ${CYAN}dubiel${NC}"
  echo -e "   Contraseña:  ${CYAN}admin${NC}"
  echo -e "   ${RED}⚠  CAMBIE LA CONTRASEÑA en Ajustes → Usuarios antes de usar en producción.${NC}"
  echo ""
  echo -e "${BOLD}📁 Archivos importantes:${NC}"
  echo -e "   App Next.js:          $APP_DIR"
  echo -e "   DB de la app:         $DB_PATH"
  echo -e "   DB license-server:    $LICENSE_DB_PATH"
  echo -e "                         (vía symlink $INSTALL_DIR/data.db)"
  echo -e "   Claves Ed25519:       $KEYS_DIR/  (private.pem + public.pem)"
  echo -e "   Esquema Prisma:       $PRISMA_DIR/schema.prisma"
  echo -e "   Variables de entorno: $ENV_FILE"
  echo -e "   Script de arranque:   $RUNTIME_SCRIPT"
  echo -e "   Logs:                 $LOGS_DIR/"
  echo -e "                         • launchd.out.log  (stdout del servicio)"
  echo -e "                         • launchd.err.log  (stderr del servicio)"
  echo ""
  echo -e "${BOLD}🛠  Gestión del servicio:${NC}"
  echo -e "   Estado:        ${CYAN}sudo launchctl list | grep kiosko${NC}"
  echo -e "   Detener:       ${CYAN}sudo launchctl unload $PLIST_PATH${NC}"
  echo -e "   Iniciar:       ${CYAN}sudo launchctl load -w $PLIST_PATH${NC}"
  echo -e "   Reiniciar:     ${CYAN}sudo launchctl kickstart -k system/$PLIST_LABEL${NC}"
  echo -e "   Ver logs:      ${CYAN}sudo tail -f $LOGS_DIR/launchd.err.log${NC}"
  echo ""
  echo -e "${BOLD}🗑  Desinstalar:${NC}"
  echo -e "   Ejecute:  ${CYAN}sudo ./scripts/uninstall-macos.sh${NC}"
  echo -e "   (o sudo $INSTALL_DIR/../uninstall-macos.sh si lo movió)"
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}⚠  RECORDATORIO IMPORTANTE — ACTIVACIÓN DE LICENCIA${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "  En el primer arranque, la app mostrará la pantalla de"
  echo -e "  \"Activación de Licencia Requerida\"."
  echo ""
  echo -e "  Para desbloquear el sistema debe:"
  echo -e "   1. Obtener un archivo .lic del administrador (emitido desde el"
  echo -e "      license-server mediante el panel super-admin)."
  echo -e "   2. Cargar o pegar el contenido del .lic en la pantalla de activación."
  echo -e "   3. La app verificará la firma Ed25519 con la clave pública y activará"
  echo -e "      el dispositivo online contra $LICENSE_DB_PATH"
  echo ""
  echo -e "  Hasta que no se active una licencia válida, todas las rutas de la"
  echo -e "  app (excepto login y /api/license/*) devolverán 503 license_required."
  echo ""
}

# -------------------------------------------------------------
# Main
# -------------------------------------------------------------
main() {
  banner "KioskoApp — Instalador para macOS"
  echo -e "  ${CYAN}Este script instalará KioskoApp como servicio del sistema.${NC}"
  echo -e "  ${CYAN}Se requiere conexión a internet (para prisma CLI y bunx).${NC}"

  preflight
  ensure_sudo
  detect_source
  copy_files
  generate_keys
  create_env
  init_db
  setup_launchd
  final_banner
}

main "$@"
