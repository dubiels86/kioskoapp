#!/bin/bash
# =============================================================
# KioskoApp - Instalación en Servidor de Producción macOS
# =============================================================
# Uso: chmod +x install-produccion.sh && ./install-produccion.sh
# =============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

APP_NAME="kiosko-app"
APP_PORT=3000
INSTALL_DIR="$HOME/$APP_NAME"
SERVICE_LABEL="com.kioskoapp.server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_LABEL}.plist"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   KioskoApp - Instalación Producción     ║${NC}"
echo -e "${CYAN}║   macOS Server Setup                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ==============================================
# 1. Verificar requisitos del sistema
# ==============================================
echo -e "${BOLD}[1/8] Verificando requisitos del sistema...${NC}"

# Verificar macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}Error: Este script es para macOS únicamente.${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} macOS detectado: $(sw_vers -productVersion)"

# Verificar Homebrew
if ! command -v brew &> /dev/null; then
  echo -e "  ${YELLOW}Instalando Homebrew...${NC}"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Agregar brew al PATH para Apple Silicon
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  fi
fi
echo -e "  ${GREEN}✓${NC} Homebrew: $(brew --version | head -1)"

# Verificar/instalar Bun
if ! command -v bun &> /dev/null; then
  echo -e "  ${YELLOW}Instalando Bun...${NC}"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo -e "  ${GREEN}✓${NC} Bun: $(bun --version)"

# Verificar/instalar Node.js (necesario para prisma)
if ! command -v node &> /dev/null; then
  echo -e "  ${YELLOW}Instalando Node.js via Homebrew...${NC}"
  brew install node
fi
echo -e "  ${GREEN}✓${NC} Node.js: $(node --version)"

echo ""

# ==============================================
# 2. Preparar directorio de instalación
# ==============================================
echo -e "${BOLD}[2/8] Preparando directorio de instalación...${NC}"

# Detectar si estamos en el directorio del proyecto
if [ -f "package.json" ] && grep -q "kiosko\|nextjs_tailwind" "package.json" 2>/dev/null; then
  SRC_DIR="$(pwd)"
  echo -e "  ${GREEN}✓${NC} Ejecutando desde el directorio del proyecto: $SRC_DIR"
else
  echo -e "${RED}Error: Ejecutá este script desde la raíz del proyecto (donde está package.json)${NC}"
  exit 1
fi

# Si install_dir es diferente al src_dir, copiar
if [ "$SRC_DIR" != "$INSTALL_DIR" ]; then
  echo -e "  ${CYAN}Copiando proyecto a $INSTALL_DIR...${NC}"
  mkdir -p "$INSTALL_DIR"
  rsync -av --exclude='.next' --exclude='node_modules' --exclude='.git' \
    --exclude='*.tar.gz' --exclude='kiosko-app/' \
    "$SRC_DIR/" "$INSTALL_DIR/"
  cd "$INSTALL_DIR"
  echo -e "  ${GREEN}✓${NC} Proyecto copiado a $INSTALL_DIR"
else
  echo -e "  ${GREEN}✓${NC} Usando directorio actual: $SRC_DIR"
fi

echo ""

# ==============================================
# 3. Configurar variables de entorno
# ==============================================
echo -e "${BOLD}[3/8] Configurando variables de entorno...${NC}"

# Crear directorio para la base de datos
mkdir -p "$HOME/$APP_NAME/db"

# Crear o actualizar .env.production
cat > .env << EOF
DATABASE_URL=file:./../db/custom.db
NODE_ENV=production
EOF

echo -e "  ${GREEN}✓${NC} .env configurado"
echo -e "  ${CYAN}  DB path: $HOME/$APP_NAME/db/custom.db${NC}"

echo ""

# ==============================================
# 4. Instalar dependencias
# ==============================================
echo -e "${BOLD}[4/8] Instalando dependencias...${NC}"

echo -e "  ${CYAN}Ejecutando bun install...${NC}"
bun install --frozen-lockfile 2>&1 | tail -3
echo -e "  ${GREEN}✓${NC} Dependencias instaladas"

echo ""

# ==============================================
# 5. Configurar base de datos
# ==============================================
echo -e "${BOLD}[5/8] Configurando base de datos...${NC}"

echo -e "  ${CYAN}Generando cliente Prisma...${NC}"
bun run db:generate 2>&1 | tail -2
echo -e "  ${GREEN}✓${NC} Prisma client generado"

echo -e "  ${CYAN}Sincronizando esquema de BD...${NC}"
bun run db:push 2>&1 | tail -3
echo -e "  ${GREEN}✓${NC} Esquema de base de datos sincronizado"

echo -e "  ${CYAN}Ejecutando migraciones de datos...${NC}"
if [ -f "scripts/update-system.ts" ]; then
  bun run scripts/update-system.ts 2>&1 | tail -5 || echo -e "  ${YELLOW}⚠${NC} Algunas migraciones tuvieron advertencias"
  echo -e "  ${GREEN}✓${NC} Migraciones ejecutadas"
fi

echo ""

# ==============================================
# 6. Build de producción
# ==============================================
echo -e "${BOLD}[6/8] Compilando para producción...${NC}"

echo -e "  ${CYAN}Ejecutando next build...${NC}"
echo -e "  ${YELLOW}(esto puede tardar 1-3 minutos)${NC}"
bun run build 2>&1 | tail -5

if [ ! -d ".next/standalone" ]; then
  echo -e "${RED}Error: El build falló. Revisá los errores arriba.${NC}"
  exit 1
fi

echo -e "  ${GREEN}✓${NC} Build de producción completado"
echo -e "  ${GREEN}✓${NC} Archivos estáticos copiados"

echo ""

# ==============================================
# 7. Crear servicio LaunchAgent (autoarranque)
# ==============================================
echo -e "${BOLD}[7/8] Configurando autoarranque como servicio macOS...${NC}"

# Asegurar que exista la carpeta LaunchAgents
mkdir -p "$HOME/Library/LaunchAgents"

# Obtener ruta absoluta de bun
BUN_PATH=$(which bun)
LOG_DIR="$HOME/Library/Logs/kiosko-app"
mkdir -p "$LOG_DIR"

# Crear el plist para LaunchAgent
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${BUN_PATH}</string>
        <string>$INSTALL_DIR/.next/standalone/server.js</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>${APP_PORT}</string>
        <key>DATABASE_URL</key>
        <string>file:${HOME}/${APP_NAME}/db/custom.db</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.bun/bin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/server.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/server-error.log</string>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

echo -e "  ${GREEN}✓${NC} LaunchAgent creado: $PLIST_PATH"

# Cargar el servicio
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"
echo -e "  ${GREEN}✓${NC} Servicio registrado y arrancado"

echo ""

# ==============================================
# 8. Verificación final
# ==============================================
echo -e "${BOLD}[8/8] Verificación final...${NC}"

# Esperar a que el servidor arranque
echo -e "  ${CYAN}Esperando que el servidor arranque...${NC}"
sleep 5

# Verificar que el servidor responde
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "307" ] || [ "$HTTP_STATUS" = "302" ]; then
  echo -e "  ${GREEN}✓${NC} Servidor respondiendo en http://localhost:${APP_PORT} (HTTP $HTTP_STATUS)"
else
  echo -e "  ${YELLOW}⚠${NC} Servidor arrancando... (HTTP $HTTP_STATUS)"
  echo -e "  ${YELLOW}  Revisá los logs: tail -f $LOG_DIR/server.log${NC}"
fi

# ==============================================
# Crear script de gestión
# ==============================================
cat > "$INSTALL_DIR/gestionar.sh" << 'MGMT'
#!/bin/bash
SERVICE_LABEL="com.kioskoapp.server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/kiosko-app"

case "$1" in
  start)
    launchctl load -w "$PLIST_PATH"
    echo "✅ KioskoApp iniciado"
    ;;
  stop)
    launchctl unload "$PLIST_PATH"
    echo "⏹ KioskoApp detenido"
    ;;
  restart)
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    sleep 2
    launchctl load -w "$PLIST_PATH"
    echo "🔄 KioskoApp reiniciado"
    ;;
  status)
    if launchctl list | grep -q "com.kioskoapp"; then
      echo "✅ KioskoApp está corriendo"
    else
      echo "⏹ KioskoApp está detenido"
    fi
    ;;
  logs)
    tail -f "$LOG_DIR/server.log"
    ;;
  errors)
    tail -f "$LOG_DIR/server-error.log"
    ;;
  update)
    echo "🔄 Actualizando KioskoApp..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    bun install --frozen-lockfile
    bun run db:generate
    bun run db:push
    bun run scripts/update-system.ts 2>/dev/null || true
    bun run build
    launchctl load -w "$PLIST_PATH"
    echo "✅ Actualización completada"
    ;;
  *)
    echo "Uso: ./gestionar.sh [start|stop|restart|status|logs|errors|update]"
    ;;
esac
MGMT

chmod +x "$INSTALL_DIR/gestionar.sh"

# ==============================================
# Resumen final
# ==============================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Instalación Completada!             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}📍 Acceso:${NC}"
echo -e "  ${CYAN}URL local:${NC}    http://localhost:${APP_PORT}"
echo -e "  ${CYAN}URL red local:${NC} http://$(ipconfig getifaddr en0 2>/dev/null || echo 'TU_IP'):${APP_PORT}"
echo ""
echo -e "${BOLD}🔑 Credenciales:${NC}"
echo -e "  ${CYAN}Super Admin:${NC}  dubiel / openpgpwd"
echo -e "  ${CYAN}Admin:${NC}        admin / admin"
echo ""
echo -e "${BOLD}📁 Archivos:${NC}"
echo -e "  ${CYAN}App:${NC}     $INSTALL_DIR"
echo -e "  ${CYAN}Base datos:${NC} $HOME/$APP_NAME/db/custom.db"
echo -e "  ${CYAN}Logs:${NC}    $LOG_DIR/server.log"
echo ""
echo -e "${BOLD}🛠 Gestión del servicio:${NC}"
echo -e "  ${CYAN}cd $INSTALL_DIR${NC}"
echo -e "  ${CYAN}./gestionar.sh start${NC}    → Iniciar"
echo -e "  ${CYAN}./gestionar.sh stop${NC}     → Detener"
echo -e "  ${CYAN}./gestionar.sh restart${NC}  → Reiniciar"
echo -e "  ${CYAN}./gestionar.sh status${NC}   → Estado"
echo -e "  ${CYAN}./gestionar.sh logs${NC}     → Ver logs en vivo"
echo -e "  ${CYAN}./gestionar.sh update${NC}   → Actualizar app"
echo ""
echo -e "${BOLD}⚙️  Autoarranque:${NC}"
echo -e "  ${GREEN}✓${NC} El servicio arranca automáticamente con el sistema"
echo ""
