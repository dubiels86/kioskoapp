#!/bin/bash
# =============================================================
# KioskoApp - Script de actualización v2
# Agrega: Módulo de Gastos, botón Descargar, fix .env
# =============================================================
# Uso: chmod +x update-v2.sh && ./update-v2.sh
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
echo -e "${CYAN}  KioskoApp - Actualización v2             ${NC}"
echo -e "${CYAN}  + Módulo Gastos                          ${NC}"
echo -e "${CYAN}  + Botón Descargar Proyecto               ${NC}"
echo -e "${CYAN}  + Fix DATABASE_URL (ruta relativa)       ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
  echo -e "${RED}Error: Ejecutá este script desde la raíz del proyecto (donde está package.json)${NC}"
  exit 1
fi

# Check if update tar.gz exists in the same directory
UPDATE_FILE=""
if [ -f "update-v2.tar.gz" ]; then
  UPDATE_FILE="update-v2.tar.gz"
elif [ -f "public/update-v2.tar.gz" ]; then
  UPDATE_FILE="public/update-v2.tar.gz"
fi

if [ -z "$UPDATE_FILE" ]; then
  echo -e "${RED}Error: No se encuentra update-v2.tar.gz${NC}"
  echo -e "Descargalo desde el proyecto y ponelo en la raíz del proyecto."
  echo -e "Luego ejecutá este script de nuevo."
  exit 1
fi

echo -e "${YELLOW}[1/4]${NC} Extrayendo archivos de actualización..."
mkdir -p /tmp/kiosko-update
tar -xzf "$UPDATE_FILE" -C /tmp/kiosko-update

echo -e "${YELLOW}[2/4]${NC} Copiando archivos nuevos y actualizados..."

# Create directories
mkdir -p src/components/expenses
mkdir -p src/app/api/expenses
mkdir -p "src/app/api/expenses/[id]"

# Copy all files from the update
if [ -d "/tmp/kiosko-update/src" ]; then
  cp -r /tmp/kiosko-update/src/* src/
  echo -e "  ${GREEN}Archivos src/ copiados${NC}"
fi

# Copy prisma schema
if [ -f "/tmp/kiosko-update/prisma/schema.prisma" ]; then
  cp /tmp/kiosko-update/prisma/schema.prisma prisma/schema.prisma
  echo -e "  ${GREEN}prisma/schema.prisma copiado${NC}"
fi

# Copy .env (only if it has the relative path fix)
if [ -f "/tmp/kiosko-update/.env" ]; then
  # Only copy if current .env has absolute path
  if grep -q "file:/" .env && ! grep -q "file:\./" .env; then
    cp /tmp/kiosko-update/.env .env
    echo -e "  ${GREEN}.env actualizado a ruta relativa${NC}"
  else
    echo -e "  ${GREEN}.env ya usa ruta relativa, no se sobrescribe${NC}"
  fi
fi

# Clean up
rm -rf /tmp/kiosko-update

echo -e "${YELLOW}[3/4]${NC} Verificando archivos..."

FILES_OK=true
check_file() {
  if [ -f "$1" ]; then
    echo -e "  ${GREEN}✓${NC} $1"
  else
    echo -e "  ${RED}✗${NC} $1 (FALTA)"
    FILES_OK=false
  fi
}

check_file "src/components/expenses/expenses-view.tsx"
check_file "src/app/api/expenses/route.ts"
check_file "src/app/api/expenses/[id]/route.ts"
check_file "src/lib/types.ts"
check_file "prisma/schema.prisma"

# Verify sidebar has expenses
if grep -q "expenses" src/components/layout/app-sidebar.tsx; then
  echo -e "  ${GREEN}✓${NC} sidebar con Gastos"
else
  echo -e "  ${RED}✗${NC} sidebar sin Gastos"
  FILES_OK=false
fi

# Verify page.tsx has ExpensesView
if grep -q "ExpensesView" src/app/page.tsx; then
  echo -e "  ${GREEN}✓${NC} page.tsx con ExpensesView"
else
  echo -e "  ${RED}✗${NC} page.tsx sin ExpensesView"
  FILES_OK=false
fi

echo -e "${YELLOW}[4/4]${NC} Ejecutando prisma db:push..."
npx prisma db:push 2>&1 || bun run db:push 2>&1 || { echo -e "${RED}Error al ejecutar db:push. Probá manualmente: bun run db:push${NC}"; }

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
echo -e "  ${CYAN}•${NC} Modelo Expense en Prisma schema"
echo -e "  ${CYAN}•${NC} API routes: /api/expenses (GET, POST, PUT, DELETE)"
echo -e "  ${CYAN}•${NC} Componente ExpensesView completo"
echo -e "  ${CYAN}•${NC} Tipos de gastos en types.ts"
echo -e "  ${CYAN}•${NC} Permisos: expenses.access, expenses.manage"
echo -e "  ${CYAN}•${NC} Sidebar: Gastos + Descargar Proyecto"
echo -e "  ${CYAN}•${NC} Fix: DATABASE_URL ruta relativa"
echo ""
echo -e "Ejecutá: ${CYAN}bun run dev${NC}"
echo ""
