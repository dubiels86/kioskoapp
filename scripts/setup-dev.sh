#!/usr/bin/env bash
#
# setup-dev.sh — Inicializa el entorno de desarrollo de KioskoApp después de clonar el repo
#
# Uso:
#   git clone https://github.com/dubiels86/kioskoapp.git
#   cd kioskoapp
#   ./setup-dev.sh
#
# Qué hace:
#   1. Verifica que node y bun estén instalados
#   2. Crea .env desde .env.example (con un secret aleatorio)
#   3. Crea el directorio db/
#   4. Instala dependencias (bun install)
#   5. Inicializa la base de datos SQLite (prisma db push)
#   6. Genera el cliente Prisma
#   7. Genera el par de claves Ed25519 para el license-server
#   8. Crea el super-admin por defecto (dubiel / admin)
#   9. Muestra cómo levantar los servicios
#

set -euo pipefail

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN:${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; }
step() { echo -e "\n${CYAN}▶ $*${NC}"; }

# Detectar directorio del script
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     KioskoApp — Setup de Desarrollo              ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ---------------------------------------------------------------------------
# 1. Verificar prerequisitos
# ---------------------------------------------------------------------------
step "Verificando prerequisitos..."

if ! command -v node >/dev/null 2>&1; then
  err "Node.js no está instalado."
  err "Instalalo desde https://nodejs.org/ (versión 20+) o con:"
  err "  macOS:   brew install node"
  err "  Linux:   sudo apt install nodejs  (o usar nvm)"
  exit 1
fi
log "Node.js: $(node --version)"

if ! command -v bun >/dev/null 2>&1; then
  err "Bun no está instalado."
  err "Instalalo con:"
  err "  curl -fsSL https://bun.sh/install | bash"
  err "Después recargá tu shell: source ~/.bashrc  (o ~/.zshrc)"
  exit 1
fi
log "Bun: $(bun --version)"

if ! command -v openssl >/dev/null 2>&1; then
  err "openssl no está instalado (necesario para generar claves Ed25519)."
  err "  macOS:   viene incluido por defecto"
  err "  Linux:   sudo apt install openssl"
  exit 1
fi
log "openssl: $(openssl version)"

# ---------------------------------------------------------------------------
# 2. Crear .env desde .env.example
# ---------------------------------------------------------------------------
step "Configurando .env..."

if [[ ! -f .env.example ]]; then
  err "No se encontró .env.example. ¿Clonaste bien el repo?"
  exit 1
fi

if [[ -f .env ]]; then
  warn ".env ya existe, no se sobrescribe."
else
  cp .env.example .env
  # Generar un secret aleatorio para LICENSE_COOKIE_SECRET
  SECRET=$(openssl rand -hex 32)
  # Reemplazar la línea del secret en .env
  if [[ "$(uname -s)" == "Darwin" ]]; then
    # macOS sed necesita -i ''
    sed -i '' "s/LICENSE_COOKIE_SECRET=change-me-in-production/LICENSE_COOKIE_SECRET=${SECRET}/" .env
  else
    sed -i "s/LICENSE_COOKIE_SECRET=change-me-in-production/LICENSE_COOKIE_SECRET=${SECRET}/" .env
  fi
  log ".env creado con secret aleatorio."
fi

# ---------------------------------------------------------------------------
# 3. Crear directorio db/
# ---------------------------------------------------------------------------
step "Creando directorio db/..."
mkdir -p db
log "Directorio db/ listo."

# ---------------------------------------------------------------------------
# 4. Instalar dependencias
# ---------------------------------------------------------------------------
step "Instalando dependencias (bun install)..."

# Dependencias del proyecto principal
bun install
log "Dependencias del proyecto instaladas."

# Dependencias del license-server
if [[ -d mini-services/license-server ]]; then
  step "Instalando dependencias del license-server..."
  (cd mini-services/license-server && bun install)
  log "Dependencias del license-server instaladas."
fi

# ---------------------------------------------------------------------------
# 5. Inicializar base de datos
# ---------------------------------------------------------------------------
step "Inicializando base de datos SQLite (prisma db push)..."

# Asegurar que DATABASE_URL use ruta relativa
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2- | tr -d '"')
if [[ "$DB_URL" == /* ]]; then
  warn "Tu DATABASE_URL es una ruta absoluta: $DB_URL"
  warn "Esto puede causar errores en macOS (/home/ no es escribible)."
  warn "Cambiando a ruta relativa..."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL="file:./db/custom.db"|' .env
  else
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./db/custom.db"|' .env
  fi
  log "DATABASE_URL cambiada a ruta relativa."
fi

bun run db:push
log "Base de datos inicializada."

# ---------------------------------------------------------------------------
# 6. Generar cliente Prisma
# ---------------------------------------------------------------------------
step "Generando cliente Prisma..."
bun run db:generate
log "Cliente Prisma generado."

# ---------------------------------------------------------------------------
# 7. Generar par de claves Ed25519 para el license-server
# ---------------------------------------------------------------------------
step "Generando claves Ed25519 para el license-server..."

KEYS_DIR="mini-services/license-server/keys"
PUB_KEY_DEST="src/lib/license-public-key.pem"

if [[ -f "$KEYS_DIR/private.pem" ]]; then
  warn "Ya existe $KEYS_DIR/private.pem — no se sobrescribe."
  if [[ ! -f "$PUB_KEY_DEST" ]]; then
    log "Regenerando clave pública desde la privada existente..."
    openssl pkey -in "$KEYS_DIR/private.pem" -pubout -out "$PUB_KEY_DEST"
  fi
else
  mkdir -p "$KEYS_DIR"
  openssl genpkey -algorithm Ed25519 -out "$KEYS_DIR/private.pem"
  chmod 600 "$KEYS_DIR/private.pem"
  log "Clave privada generada: $KEYS_DIR/private.pem"

  # Extraer la pública en formato SPKI PEM (que es lo que espera license.ts)
  openssl pkey -in "$KEYS_DIR/private.pem" -pubout -out "$PUB_KEY_DEST"
  log "Clave pública generada: $PUB_KEY_DEST"
fi

# ---------------------------------------------------------------------------
# 8. Crear super-admin por defecto
# ---------------------------------------------------------------------------
step "Creando super-admin por defecto (dubiel / admin)..."

# Verificar si ya existe el usuario dubiel
ADMIN_EXISTS=$(bun -e '
import { db } from "./src/lib/db";
const user = await db.user.findUnique({ where: { username: "dubiel" } });
console.log(user ? "exists" : "none");
' 2>/dev/null || echo "none")

if [[ "$ADMIN_EXISTS" == "exists" ]]; then
  warn "El usuario 'dubiel' ya existe — no se crea de nuevo."
else
  log "Creando super-admin..."
  if [[ -f scripts/create-super-admin.ts ]]; then
    bun run scripts/create-super-admin.ts 2>&1 | tail -5 || \
      warn "No se pudo crear el super-admin automáticamente. Ejecutá manualmente:"
      warn "  bun run scripts/create-super-admin.ts"
  else
    warn "No se encontró scripts/create-super-admin.ts."
    warn "Creando usuario inline..."

    bun -e '
import { db } from "./src/lib/db";
import bcrypt from "bcryptjs";

// Buscar o crear el rol super-admin
let role = await db.role.findUnique({ where: { name: "Super Administrador" } });
if (!role) {
  role = await db.role.create({
    data: {
      name: "Super Administrador",
      description: "Acceso total al sistema",
      permissions: JSON.stringify([
        "pos.use", "inventory.view", "inventory.edit",
        "purchases.view", "purchases.edit",
        "cash.view", "cash.manage",
        "repairs.view", "repairs.edit",
        "reports.view", "settings.all"
      ]),
      isActive: true
    }
  });
}

// Crear usuario dubiel/admin si no existe
const existing = await db.user.findUnique({ where: { username: "dubiel" } });
if (!existing) {
  const hashed = bcrypt.hashSync("admin", 10);
  await db.user.create({
    data: {
      username: "dubiel",
      password: hashed,
      name: "Dubiel",
      email: "admin@kiosko.app",
      roleId: role.id,
      isActive: true
    }
  });
  console.log("✓ Super-admin creado: dubiel / admin");
}
await db.$disconnect();
' 2>&1 | tail -5 || warn "No se pudo crear el super-admin automáticamente."
  fi
fi

# ---------------------------------------------------------------------------
# 9. Resumen final
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  Setup completado!                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Para levantar los servicios:${NC}"
echo ""
echo -e "  ${BLUE}Terminal 1${NC} — license-server (puerto 3042):"
echo -e "    cd mini-services/license-server"
echo -e "    bun run dev"
echo ""
echo -e "  ${BLUE}Terminal 2${NC} — app Next.js (puerto 3000):"
echo -e "    bun run dev"
echo ""
echo -e "  Después abrí ${CYAN}http://localhost:3000${NC} en el navegador."
echo ""
echo -e "${CYAN}Credenciales del super-admin:${NC}"
echo -e "  Usuario: ${YELLOW}dubiel${NC}"
echo -e "  Password: ${YELLOW}admin${NC}"
echo -e "  ${RED}(cambiar la password inmediatamente después de entrar)${NC}"
echo ""
echo -e "${CYAN}Primer uso:${NC}"
echo -e "  1. Iniciá sesión como dubiel / admin"
echo -e "  2. Andá a Ajustes → Licencias → Emitir nueva licencia"
echo -e "  3. Completá los datos y click 'Emitir licencia'"
echo -e "  4. Copiá el JSON de la licencia emitida"
echo -e "  5. Cerrá sesión → pegá el JSON en la pantalla de activación → Activar"
echo ""
echo -e "${CYAN}Claves Ed25519:${NC}"
echo -e "  Privada: ${YELLOW}mini-services/license-server/keys/private.pem${NC}"
echo -e "  Pública: ${YELLOW}src/lib/license-public-key.pem${NC}"
echo -e "  ${RED}(la privada NUNCA debe salir de esta máquina)${NC}"
echo ""
