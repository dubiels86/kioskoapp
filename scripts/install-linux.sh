#!/usr/bin/env bash
# =============================================================
# KioskoApp — Instalador para servidores Linux
# -------------------------------------------------------------
# Distribuido dentro del tarball `kioskoapp-installer.tar.gz`.
# El usuario copia el tarball al servidor, lo extrae y ejecuta:
#
#     sudo ./install-linux.sh
#
# El script instala la app (Next.js standalone) + el license-server
# (binario nativo Bun) en /opt/kioskoapp, inicializa la BD SQLite,
# genera el par de claves Ed25519, crea el usuario del sistema
# `kiosko`, configura el servicio systemd y arranca la app.
#
# No expone código fuente: todo viene precompilado en el tarball.
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
# Constantes de instalación
# -------------------------------------------------------------
INSTALL_DIR="/opt/kioskoapp"
APP_DIR="$INSTALL_DIR/app"
PRISMA_DIR="$INSTALL_DIR/prisma"
DATA_DIR="$INSTALL_DIR/data"
KEYS_DIR="$INSTALL_DIR/keys"
LOG_DIR="/var/log/kioskoapp"
ENV_FILE="$INSTALL_DIR/kiosko.env"
RUNTIME_SCRIPT="$INSTALL_DIR/kiosko-runtime.sh"
LICENSE_SERVER_BIN="$INSTALL_DIR/license-server"

SERVICE_NAME="kioskoapp"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SYSTEM_USER="kiosko"
SYSTEM_GROUP="kiosko"

APP_PORT=3000
LICENSE_PORT=3042
DB_PATH="$DATA_DIR/custom.db"
LICENSE_DB_PATH="$DATA_DIR/license-server.db"

# -------------------------------------------------------------
# Funciones de logging
# -------------------------------------------------------------
log_info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()  { echo -e "${BLUE}${BOLD}==>${NC} ${BOLD}$*${NC}"; }
die()       { log_err "$*"; exit 1; }

# Separador visual
hr() { echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"; }

# Pregunta sí/no (por defecto No a menos que se pase 'y' como $2)
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

# -------------------------------------------------------------
# Detectar directorio base del tarball (donde está este script)
# -------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================
# 0. Cabecera
# =============================================================
echo ""
hr
echo -e "${CYAN}${BOLD}  KioskoApp — Instalador para Linux${NC}"
echo -e "${CYAN}  POS + Inventario + Sistema de Licencias${NC}"
hr
echo ""

# =============================================================
# 1. Verificar root / sudo
# =============================================================
log_step "Verificando permisos de administrador..."

if [[ $EUID -ne 0 ]]; then
  log_err "Este script debe ejecutarse como root o con sudo."
  echo ""
  echo -e "  Ejecutá:"
  echo -e "  ${CYAN}sudo ./install-linux.sh${NC}"
  echo ""
  exit 1
fi
log_ok "Ejecutando como root (UID=0)."

# =============================================================
# 2. Verificaciones del sistema (preflight)
# =============================================================
log_step "Verificando sistema operativo y dependencias..."

# 2.1 — Linux
if [[ "$(uname -s)" != "Linux" ]]; then
  die "Este instalador es para Linux. En macOS usá install-produccion.sh."
fi
log_ok "Sistema operativo: Linux ($(uname -r))"

# 2.2 — Init system (systemd preferido)
INIT_SYSTEM="unknown"
if command -v systemctl >/dev/null 2>&1 && systemctl list-units >/dev/null 2>&1; then
  INIT_SYSTEM="systemd"
  log_ok "Sistema de init: systemd (preferido)"
else
  INIT_SYSTEM="sysvinit"
  log_warn "No se detectó systemd. Este instalador requiere systemd."
  log_warn "Si usás sysvinit/OpenRC/Upstart, configurá el servicio manualmente."
  die "systemd es obligatorio para este instalador."
fi

# 2.3 — node >= 18
if ! command -v node >/dev/null 2>&1; then
  log_err "Node.js no está instalado."
  echo ""
  echo -e "  Instalalo con:"
  echo -e "  ${CYAN}# Debian/Ubuntu:${NC}"
  echo -e "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
  echo -e "  ${CYAN}# RHEL/CentOS/Fedora:${NC}"
  echo -e "  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && yum install -y nodejs"
  echo ""
  exit 1
fi
NODE_VERSION="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [[ "$NODE_VERSION" -lt 18 ]]; then
  log_err "Node.js $NODE_VERSION detectado. Se requiere Node.js >= 18."
  echo ""
  echo -e "  Actualizá con:"
  echo -e "  ${CYAN}curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs${NC}"
  echo ""
  exit 1
fi
log_ok "Node.js $(node --version) detectado (>= 18)"

# 2.4 — bun
if ! command -v bun >/dev/null 2>&1; then
  log_err "Bun no está instalado."
  echo ""
  echo -e "  Instalalo con:"
  echo -e "  ${CYAN}curl -fsSL https://bun.sh/install | bash${NC}"
  echo -e "  Luego recargá el shell: ${CYAN}source ~/.bashrc${NC} (o abrí una nueva terminal)"
  echo -e "  Y volvé a ejecutar este script con ${CYAN}sudo -E ./install-linux.sh${NC}"
  echo ""
  exit 1
fi
log_ok "Bun $(bun --version) detectado"

# 2.5 — openssl (para generar claves Ed25519)
if ! command -v openssl >/dev/null 2>&1; then
  log_err "openssl no está instalado."
  echo ""
  echo -e "  Instalalo con:"
  echo -e "  ${CYAN}apt-get install -y openssl${NC}  (Debian/Ubuntu)"
  echo -e "  ${CYAN}yum install -y openssl${NC}      (RHEL/CentOS)"
  echo ""
  exit 1
fi
log_ok "openssl $(openssl version | awk '{print $2}') detectado"

# 2.6 — Verificar que el contenido del tarball está al lado del script
log_step "Verificando contenido del tarball..."

if [[ ! -d "$SCRIPT_DIR/app" ]]; then
  die "No se encontró el directorio 'app/' junto a este script ($SCRIPT_DIR/app). Extraé el tarball completo antes de ejecutar."
fi
if [[ ! -f "$SCRIPT_DIR/license-server" ]]; then
  die "No se encontró el binario 'license-server' junto a este script ($SCRIPT_DIR/license-server)."
fi
if [[ ! -f "$SCRIPT_DIR/prisma/schema.prisma" ]]; then
  die "No se encontró 'prisma/schema.prisma' junto a este script."
fi
if [[ ! -f "$SCRIPT_DIR/scripts/kiosko-runtime.sh" ]]; then
  die "No se encontró 'scripts/kiosko-runtime.sh' junto a este script."
fi
log_ok "Contenido del tarball verificado en: $SCRIPT_DIR"

# =============================================================
# 3. Crear usuario del sistema `kiosko`
# =============================================================
log_step "Creando usuario del sistema '${SYSTEM_USER}'..."

if id "$SYSTEM_USER" >/dev/null 2>&1; then
  log_warn "El usuario '${SYSTEM_USER}' ya existe. Se reutiliza."
else
  # nologin location varies; detect the correct path
  NOLOGIN_SHELL="/usr/sbin/nologin"
  [[ -x "/sbin/nologin" ]] && NOLOGIN_SHELL="/sbin/nologin"
  useradd --system --no-create-home --shell "$NOLOGIN_SHELL" "$SYSTEM_USER"
  log_ok "Usuario '${SYSTEM_USER}' creado (system account, sin shell)."
fi

# =============================================================
# 4. Crear directorios
# =============================================================
log_step "Creando directorios de instalación..."

mkdir -p "$INSTALL_DIR" "$APP_DIR" "$PRISMA_DIR" "$DATA_DIR" "$KEYS_DIR" "$LOG_DIR"

# Los logs pertenecen al usuario kiosko desde el principio
chown "${SYSTEM_USER}:${SYSTEM_GROUP}" "$LOG_DIR"
chmod 0750 "$LOG_DIR"

log_ok "Directorios creados:"
echo -e "    ${CYAN}$INSTALL_DIR${NC}"
echo -e "    ${CYAN}$LOG_DIR${NC}"

# =============================================================
# 5. Copiar archivos del tarball a /opt/kioskoapp
# =============================================================
log_step "Copiando archivos al destino..."

# 5.1 — App Next.js standalone (server.js + .next + public + node_modules)
log_info "Copiando app/ (Next.js standalone)..."
rm -rf "$APP_DIR"
cp -a "$SCRIPT_DIR/app" "$APP_DIR"

# 5.2 — Binario del license-server
log_info "Copiando license-server (binario nativo Bun)..."
cp -f "$SCRIPT_DIR/license-server" "$LICENSE_SERVER_BIN"
chmod 0755 "$LICENSE_SERVER_BIN"

# 5.3 — Esquema Prisma
log_info "Copiando prisma/schema.prisma..."
cp -f "$SCRIPT_DIR/prisma/schema.prisma" "$PRISMA_DIR/schema.prisma"

# 5.4 — Script de runtime (arranca ambos servicios)
log_info "Copiando kiosko-runtime.sh..."
cp -f "$SCRIPT_DIR/scripts/kiosko-runtime.sh" "$RUNTIME_SCRIPT"
chmod 0755 "$RUNTIME_SCRIPT"

log_ok "Archivos copiados."

# =============================================================
# 6. Generar par de claves Ed25519 (si no existe)
# =============================================================
log_step "Configurando claves criptográficas Ed25519..."

# El license-server busca keys/private.pem relativo a su propio binario.
# Como el binario está en /opt/kioskoapp/license-server, import.meta.dir
# resuelve a /opt/kioskoapp, así que busca /opt/kioskoapp/keys/private.pem.
# Esa ruta coincide con nuestra convención. ✓

if [[ -f "$KEYS_DIR/private.pem" ]]; then
  log_warn "Ya existe $KEYS_DIR/private.pem. Se conserva el par existente."
else
  log_info "Generando nueva clave privada Ed25519..."
  openssl genpkey -algorithm Ed25519 -out "$KEYS_DIR/private.pem"
  chmod 0600 "$KEYS_DIR/private.pem"

  log_info "Extrayendo clave pública (formato SPKI PEM)..."
  openssl pkey -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"
  chmod 0644 "$KEYS_DIR/public.pem"

  log_ok "Par Ed25519 generado."
fi

# La clave pública también debe estar accesible a la app Next.js.
# En el build standalone, src/lib/license-public-key.pem ya viene embebido
# como recurso. Si el build espera una copia en runtime, la dejamos aquí:
if [[ -f "$KEYS_DIR/public.pem" ]]; then
  log_info "Clave pública disponible en: $KEYS_DIR/public.pem"
  log_warn "Si la app la busca en otro path, copiala manualmente o ajustá kiosko.env."
fi

# =============================================================
# 7. Configurar BD del license-server (symlink para ubicación limpia)
# =============================================================
log_step "Configurando BD del license-server..."

# El binario del license-server tiene hardcoded `data.db` en su mismo dir.
# Para que la BD viva en data/license-server.db (más limpio para backups),
# creamos un symlink: /opt/kioskoapp/data.db -> data/license-server.db
if [[ ! -e "$LICENSE_DB_PATH" ]]; then
  # Pre-crear el archivo vacío para que el symlink apunte a algo que existe
  : > "$LICENSE_DB_PATH"
fi
if [[ -e "$INSTALL_DIR/data.db" && ! -L "$INSTALL_DIR/data.db" ]]; then
  # data.db existe y NO es symlink — es un archivo real de una instalación previa.
  # Lo migrmos a la nueva ubicación.
  log_warn "Se encontró $INSTALL_DIR/data.db como archivo real. Migrando a $LICENSE_DB_PATH..."
  mv -f "$INSTALL_DIR/data.db" "$LICENSE_DB_PATH"
fi
ln -sfn "$LICENSE_DB_PATH" "$INSTALL_DIR/data.db"
log_ok "Symlink creado: $INSTALL_DIR/data.db -> $LICENSE_DB_PATH"

# =============================================================
# 8. Generar kiosko.env con todas las variables
# =============================================================
log_step "Generando archivo de configuración kiosko.env..."

# Generar ADMIN_API_KEY aleatorio (32 bytes hex = 64 chars)
ADMIN_API_KEY="$(openssl rand -hex 32)"

# Generar un segundo secreto para firmar cookies de licencia (HMAC)
LICENSE_COOKIE_SECRET="$(openssl rand -hex 32)"

# Escribir kiosko.env (lo lee systemd vía EnvironmentFile)
cat > "$ENV_FILE" <<EOF
# =============================================================
# KioskoApp — Variables de entorno
# Generado por install-linux.sh el $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# NO editar a mano salvo que sepas lo que hacés.
# =============================================================

# --- App Next.js ---
NODE_ENV=production
PORT=${APP_PORT}
HOSTNAME=0.0.0.0

# --- Base de datos principal (SQLite) ---
DATABASE_URL=file:${DB_PATH}

# --- License-server mini-service ---
LICENSE_SERVER_URL=http://localhost:${LICENSE_PORT}
LICENSE_SERVER_ADMIN_KEY=kiosko-admin-secret-2025
# (El binario compilado del license-server usa la clave hardcoded de arriba.
#  Si lo recompilás para leerla desde env, usá esta variable.)

# --- Clave pública de verificación de licencias (PEM embebida en el build) ---
# Path donde la app la busca. Si el build ya la trae embebida, esta variable
# es solo informativa.
LICENSE_PUBLIC_KEY_PATH=${KEYS_DIR}/public.pem

# --- Secretos generados en la instalación ---
ADMIN_API_KEY=${ADMIN_API_KEY}
LICENSE_COOKIE_SECRET=${LICENSE_COOKIE_SECRET}

# --- Paths ---
INSTALL_DIR=${INSTALL_DIR}
LOG_DIR=${LOG_DIR}
EOF
chmod 0640 "$ENV_FILE"
log_ok "kiosko.env generado en $ENV_FILE"

# =============================================================
# 9. Inicializar la BD principal (SQLite + Prisma schema)
# =============================================================
log_step "Inicializando base de datos (Prisma db push)..."

# Exportar DATABASE_URL para que prisma lo lea (también viene del env file,
# pero prisma CLI no lee el env file automáticamente — solo .env)
export DATABASE_URL="file:${DB_PATH}"

log_info "Ejecutando: bunx prisma db push --schema $PRISMA_DIR/schema.prisma"
pushd "$APP_DIR" >/dev/null
if ! bunx prisma db push --schema "$PRISMA_DIR/schema.prisma" --accept-data-loss; then
  popd >/dev/null
  die "Falló prisma db push. Revisá el esquema y los permisos del directorio $DATA_DIR."
fi
popd >/dev/null
log_ok "Esquema de BD aplicado a: $DB_PATH"

# =============================================================
# 10. Seed del super-admin (dubiel / admin)
# =============================================================
log_step "Creando super-admin inicial (dubiel / admin)..."

# Script JS temporal que usa @prisma/client y bcryptjs del node_modules del app
SEED_SCRIPT="$(mktemp /tmp/kiosko-seed-XXXXXX.js)"
cat > "$SEED_SCRIPT" <<'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SUPER_ADMIN_USERNAME = 'dubiel';
const SUPER_ADMIN_PASSWORD = 'admin';
const SUPER_ADMIN_NAME = 'Dubiel';
const SUPER_ADMIN_EMAIL = 'dubiel@kioskoapp.com';
const SUPER_ADMIN_ROLE_NAME = 'Super Administrador';

const ALL_PERMISSIONS = [
  'pos.access', 'pos.refund',
  'inventory.access', 'inventory.manage',
  'purchases.access', 'purchases.manage',
  'expenses.access', 'expenses.manage',
  'cash.access', 'cash.open', 'cash.close',
  'repairs.access', 'repairs.manage',
  'reports.access',
  'settings.access', 'settings.users', 'settings.roles', 'settings.all',
];

async function main() {
  // 1. Crear o actualizar el rol Super Administrador
  let role = await prisma.role.findFirst({ where: { name: SUPER_ADMIN_ROLE_NAME } });
  if (role) {
    role = await prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: JSON.stringify(ALL_PERMISSIONS),
        description: 'Acceso total al sistema - Super Administrador',
        isActive: true,
      },
    });
    console.log(`Rol "${SUPER_ADMIN_ROLE_NAME}" actualizado.`);
  } else {
    role = await prisma.role.create({
      data: {
        name: SUPER_ADMIN_ROLE_NAME,
        description: 'Acceso total al sistema - Super Administrador',
        permissions: JSON.stringify(ALL_PERMISSIONS),
        isActive: true,
      },
    });
    console.log(`Rol "${SUPER_ADMIN_ROLE_NAME}" creado.`);
  }

  // 2. Crear o actualizar el usuario dubiel
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  const existing = await prisma.user.findUnique({ where: { username: SUPER_ADMIN_USERNAME } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashedPassword,
        name: SUPER_ADMIN_NAME,
        roleId: role.id,
        isActive: true,
      },
    });
    console.log(`Usuario "${SUPER_ADMIN_USERNAME}" actualizado.`);
  } else {
    await prisma.user.create({
      data: {
        username: SUPER_ADMIN_USERNAME,
        password: hashedPassword,
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        roleId: role.id,
        isActive: true,
      },
    });
    console.log(`Usuario "${SUPER_ADMIN_USERNAME}" creado.`);
  }

  // 3. Verificación
  const verify = await prisma.user.findUnique({
    where: { username: SUPER_ADMIN_USERNAME },
    include: { role: true },
  });
  if (!verify || !verify.isActive || verify.role.name !== SUPER_ADMIN_ROLE_NAME) {
    throw new Error('Verificación falló: el usuario no quedó activo con el rol correcto.');
  }
  console.log('Verificación OK: super-admin activo con rol Super Administrador.');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
EOF

log_info "Ejecutando seed..."
pushd "$APP_DIR" >/dev/null
if ! bun "$SEED_SCRIPT"; then
  popd >/dev/null
  rm -f "$SEED_SCRIPT"
  die "Falló el seed del super-admin. Revisá los logs arriba."
fi
popd >/dev/null
rm -f "$SEED_SCRIPT"
log_ok "Super-admin creado: dubiel / admin"

# =============================================================
# 11. Ajustar permisos finales
# =============================================================
log_step "Ajustando permisos..."

# La app corre como usuario kiosko — todo /opt/kioskoapp le pertenece
chown -R "${SYSTEM_USER}:${SYSTEM_GROUP}" "$INSTALL_DIR"

# Permisos restrictivos en claves y env
chmod 0600 "$KEYS_DIR/private.pem"
chmod 0644 "$KEYS_DIR/public.pem"
chmod 0640 "$ENV_FILE"

# data/ y keys/ no legibles por otros
chmod 0750 "$DATA_DIR" "$KEYS_DIR"

log_ok "Permisos ajustados (owner: ${SYSTEM_USER}:${SYSTEM_GROUP})."

# =============================================================
# 12. Crear servicio systemd
# =============================================================
log_step "Configurando servicio systemd '${SERVICE_NAME}'..."

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=KioskoApp POS + Inventory System
After=network.target

[Service]
Type=simple
User=${SYSTEM_USER}
Group=${SYSTEM_GROUP}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${RUNTIME_SCRIPT}
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/app.log
StandardError=append:${LOG_DIR}/app.err.log

# Hardening básico
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=${INSTALL_DIR} ${LOG_DIR}

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$SERVICE_FILE"
log_ok "Service file creado: $SERVICE_FILE"

# =============================================================
# 13. Habilitar y arrancar el servicio
# =============================================================
log_step "Recargando systemd y habilitando el servicio..."

systemctl daemon-reload
log_ok "systemd daemon-reload OK"

systemctl enable "${SERVICE_NAME}.service"
log_ok "Servicio habilitado para auto-arranque en boot"

log_info "Iniciando servicio..."
systemctl start "${SERVICE_NAME}.service"

log_info "Esperando 5 segundos a que arranque..."
sleep 5

# =============================================================
# 14. Verificar estado del servicio
# =============================================================
log_step "Verificando estado del servicio..."

if systemctl is-active --quiet "${SERVICE_NAME}.service"; then
  log_ok "Servicio ${SERVICE_NAME} está ACTIVO."
else
  log_warn "El servicio aún no está activo. Mostrando estado:"
  systemctl status "${SERVICE_NAME}.service" --no-pager -l || true
  echo ""
  log_warn "Revisá los logs con: ${CYAN}sudo journalctl -u ${SERVICE_NAME} -e${NC}"
  log_warn "O los archivos: ${CYAN}sudo tail -f ${LOG_DIR}/app.err.log${NC}"
fi

# Probar endpoints
log_info "Verificando endpoints HTTP..."
APP_HTTP="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/" 2>/dev/null || echo "000")"
LIC_HTTP="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${LICENSE_PORT}/api/health" 2>/dev/null || echo "000")"

if [[ "$APP_HTTP" == "200" || "$APP_HTTP" == "307" || "$APP_HTTP" == "302" ]]; then
  log_ok "App responde en http://localhost:${APP_PORT}/ (HTTP $APP_HTTP)"
else
  log_warn "App aún no responde (HTTP $APP_HTTP). Puede tardar unos segundos más en arrancar."
fi

if [[ "$LIC_HTTP" == "200" ]]; then
  log_ok "License-server responde en http://localhost:${LICENSE_PORT}/api/health (HTTP $LIC_HTTP)"
else
  log_warn "License-server aún no responde (HTTP $LIC_HTTP). Puede tardar unos segundos más."
fi

# =============================================================
# 15. Banner final de éxito
# =============================================================
echo ""
hr
echo -e "${GREEN}${BOLD}  ✅  INSTALACIÓN COMPLETADA${NC}"
hr
echo ""
echo -e "${BOLD}📍 Ubicación de instalación:${NC}"
echo -e "    ${CYAN}$INSTALL_DIR${NC}"
echo ""
echo -e "${BOLD}🌐 URLs de acceso:${NC}"
echo -e "    App (POS + Inventario):  ${CYAN}http://localhost:${APP_PORT}${NC}"
echo -e "    License-server health:   ${CYAN}http://localhost:${LICENSE_PORT}/api/health${NC}"
echo ""
echo -e "${BOLD}🔑 Credenciales del super-admin:${NC}"
echo -e "    Usuario:    ${CYAN}dubiel${NC}"
echo -e "    Contraseña: ${CYAN}admin${NC}"
echo -e "    ${RED}⚠️  CAMBIÁ LA CONTRASEÑA en Ajustes > Usuarios en el primer login.${NC}"
echo ""
echo -e "${BOLD}📁 Archivos importantes:${NC}"
echo -e "    App dir:        ${CYAN}$APP_DIR${NC}"
echo -e "    BD principal:   ${CYAN}$DB_PATH${NC}"
echo -e "    BD licencias:   ${CYAN}$LICENSE_DB_PATH${NC}"
echo -e "    Clave privada:  ${CYAN}$KEYS_DIR/private.pem${NC}  ${RED}(NUNCA compartir)${NC}"
echo -e "    Clave pública:  ${CYAN}$KEYS_DIR/public.pem${NC}"
echo -e "    Env config:     ${CYAN}$ENV_FILE${NC}"
echo -e "    Logs:           ${CYAN}$LOG_DIR/app.log${NC}"
echo -e "                    ${CYAN}$LOG_DIR/app.err.log${NC}"
echo -e "    Service file:   ${CYAN}$SERVICE_FILE${NC}"
echo ""
echo -e "${BOLD}🛠️  Gestión del servicio:${NC}"
echo -e "    Estado:     ${CYAN}sudo systemctl status ${SERVICE_NAME}${NC}"
echo -e "    Detener:    ${CYAN}sudo systemctl stop ${SERVICE_NAME}${NC}"
echo -e "    Arrancar:   ${CYAN}sudo systemctl start ${SERVICE_NAME}${NC}"
echo -e "    Reiniciar:  ${CYAN}sudo systemctl restart ${SERVICE_NAME}${NC}"
echo -e "    Ver logs:   ${CYAN}sudo journalctl -u ${SERVICE_NAME} -f${NC}"
echo -e "    Log app:    ${CYAN}sudo tail -f ${LOG_DIR}/app.log${NC}"
echo -e "    Log error:  ${CYAN}sudo tail -f ${LOG_DIR}/app.err.log${NC}"
echo ""
echo -e "${BOLD}🗑️  Desinstalación:${NC}"
echo -e "    Ejecutá el script: ${CYAN}sudo ./uninstall-linux.sh${NC}"
echo -e "    (incluido en el mismo tarball)"
echo ""
echo -e "${YELLOW}${BOLD}⚠️  RECORDATORIO IMPORTANTE:${NC}"
echo -e "  ${YELLOW}Antes de usar la app, debés ACTIVAR UNA LICENCIA.${NC}"
echo -e "  ${YELLOW}Pedila al panel super-admin o al emisor de licencias.${NC}"
echo -e "  ${YELLOW}La app mostrará el LicenseGate hasta que se active.${NC}"
echo ""
hr
echo -e "${GREEN}  Instalación finalizada. Abrí http://localhost:${APP_PORT} en el navegador.${NC}"
hr
echo ""
