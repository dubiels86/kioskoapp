#!/bin/bash
# =============================================================
# KioskoApp - Script de actualización v3
# Agrega: Sistema de Login, Autenticación, Permisos por Rol
# =============================================================
# Uso: chmod +x update-v3.sh && ./update-v3.sh
# Ejecutar desde la raíz del proyecto descargado
# =============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  KioskoApp - Actualización v3             ${NC}"
echo -e "${CYAN}  + Sistema de Login / Autenticación       ${NC}"
echo -e "${CYAN}  + Pantalla de inicio de sesión           ${NC}"
echo -e "${CYAN}  + Permisos por rol en navegación         ${NC}"
echo -e "${CYAN}  + bcrypt para contraseñas                ${NC}"
echo -e "${CYAN}  + Roles: Administrador, Vendedor, Cajero,${NC}"
echo -e "${CYAN}           Depósito                        ${NC}"
echo -e "${CYAN}  + Usuario admin por defecto              ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
  echo -e "${RED}Error: Ejecutá este script desde la raíz del proyecto (donde está package.json)${NC}"
  exit 1
fi

# Check if update tar.gz exists in the same directory
UPDATE_FILE=""
if [ -f "update-v3.tar.gz" ]; then
  UPDATE_FILE="update-v3.tar.gz"
elif [ -f "public/update-v3.tar.gz" ]; then
  UPDATE_FILE="public/update-v3.tar.gz"
fi

if [ -z "$UPDATE_FILE" ]; then
  echo -e "${RED}Error: No se encuentra update-v3.tar.gz${NC}"
  echo -e "Descargalo desde el proyecto y ponelo en la raíz del proyecto."
  echo -e "Luego ejecutá este script de nuevo."
  exit 1
fi

echo -e "${YELLOW}[1/5]${NC} Extrayendo archivos de actualización..."
mkdir -p /tmp/kiosko-update-v3
tar -xzf "$UPDATE_FILE" -C /tmp/kiosko-update-v3

echo -e "${YELLOW}[2/5]${NC} Copiando archivos nuevos y actualizados..."

# Create directories
mkdir -p src/components/auth
mkdir -p src/app/api/auth/login
mkdir -p src/app/api/auth/logout
mkdir -p src/app/api/auth/session
mkdir -p scripts

# Copy all files from the update
if [ -d "/tmp/kiosko-update-v3/src" ]; then
  cp -r /tmp/kiosko-update-v3/src/* src/
  echo -e "  ${GREEN}Archivos src/ copiados${NC}"
fi

# Copy scripts
if [ -d "/tmp/kiosko-update-v3/scripts" ]; then
  cp -r /tmp/kiosko-update-v3/scripts/* scripts/
  echo -e "  ${GREEN}Scripts copiados${NC}"
fi

# Copy prisma schema if needed
if [ -f "/tmp/kiosko-update-v3/prisma/schema.prisma" ]; then
  cp /tmp/kiosko-update-v3/prisma/schema.prisma prisma/schema.prisma
  echo -e "  ${GREEN}prisma/schema.prisma copiado${NC}"
fi

# Copy seed if needed
if [ -f "/tmp/kiosko-update-v3/prisma/seed.ts" ]; then
  cp /tmp/kiosko-update-v3/prisma/seed.ts prisma/seed.ts
  echo -e "  ${GREEN}prisma/seed.ts copiado${NC}"
fi

# Clean up
rm -rf /tmp/kiosko-update-v3

echo -e "${YELLOW}[3/5]${NC} Instalando dependencia bcryptjs..."
if command -v bun &> /dev/null; then
  bun add bcryptjs 2>&1 && echo -e "  ${GREEN}bcryptjs instalado con bun${NC}" || echo -e "  ${YELLOW}No se pudo instalar con bun, probá manualmente${NC}"
else
  npm install bcryptjs 2>&1 && echo -e "  ${GREEN}bcryptjs instalado con npm${NC}" || echo -e "  ${YELLOW}No se pudo instalar con npm, probá manualmente${NC}"
fi

echo -e "${YELLOW}[4/5]${NC} Verificando archivos..."

FILES_OK=true
check_file() {
  if [ -f "$1" ]; then
    echo -e "  ${GREEN}✓${NC} $1"
  else
    echo -e "  ${RED}✗${NC} $1 (FALTA)"
    FILES_OK=false
  fi
}

check_file "src/lib/auth.ts"
check_file "src/components/auth/login-view.tsx"
check_file "src/app/api/auth/login/route.ts"
check_file "src/app/api/auth/logout/route.ts"
check_file "src/app/api/auth/session/route.ts"
check_file "src/app/page.tsx"
check_file "src/lib/store.ts"
check_file "src/components/layout/app-sidebar.tsx"
check_file "src/components/layout/app-header.tsx"
check_file "scripts/migrate-add-auth.ts"

# Verify page.tsx has LoginView
if grep -q "LoginView" src/app/page.tsx; then
  echo -e "  ${GREEN}✓${NC} page.tsx con LoginView"
else
  echo -e "  ${RED}✗${NC} page.tsx sin LoginView"
  FILES_OK=false
fi

# Verify store has auth
if grep -q "hasPermission" src/lib/store.ts; then
  echo -e "  ${GREEN}✓${NC} store con autenticación"
else
  echo -e "  ${RED}✗${NC} store sin autenticación"
  FILES_OK=false
fi

echo -e "${YELLOW}[5/5]${NC} Ejecutando migración de base de datos..."

# Push schema changes
npx prisma db:push 2>&1 || bun run db:push 2>&1 || { echo -e "${YELLOW}Advertencia: prisma db:push falló, probá manualmente: bun run db:push${NC}"; }

# Run auth migration (create roles and admin user)
if [ -f "scripts/migrate-add-auth.ts" ]; then
  echo -e "  ${CYAN}Ejecutando migración de autenticación...${NC}"
  bun run scripts/migrate-add-auth.ts 2>&1 || npx tsx scripts/migrate-add-auth.ts 2>&1 || { echo -e "${YELLOW}Advertencia: migración de auth falló. Probá manualmente: bun run scripts/migrate-add-auth.ts${NC}"; }
fi

echo ""
echo -e "${GREEN}============================================${NC}"
if [ "$FILES_OK" = true ]; then
  echo -e "${GREEN}  ✅ Actualización completada!             ${NC}"
else
  echo -e "${YELLOW}  ⚠️  Actualización parcial                 ${NC}"
  echo -e "${YELLOW}  Revisá los archivos faltantes arriba     ${NC}"
fi
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Cambios aplicados:"
echo -e "  ${CYAN}•${NC} Pantalla de Login (usuario + contraseña)"
echo -e "  ${CYAN}•${NC} API de autenticación (login, logout, session)"
echo -e "  ${CYAN}•${NC} Contraseñas hasheadas con bcrypt"
echo -e "  ${CYAN}•${NC} Permisos por rol en la navegación"
echo -e "  ${CYAN}•${NC} Info del usuario en sidebar + logout"
echo -e "  ${CYAN}•${NC} Roles creados: Administrador, Vendedor, Cajero, Depósito"
echo -e "  ${CYAN}•${NC} Contraseñas base64 actualizadas a bcrypt"
echo ""
echo -e "${YELLOW}Credenciales por defecto:${NC}"
echo -e "  ${CYAN}Usuario:${NC} admin    ${CYAN}Contraseña:${NC} admin"
echo ""
echo -e "Ejecutá: ${CYAN}bun run dev${NC}"
echo ""
