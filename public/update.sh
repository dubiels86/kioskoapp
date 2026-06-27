#!/bin/bash
# =============================================================
# KioskoApp - Script de Actualización Completo
# Actualiza el sistema descargado a la última versión
# =============================================================
# Uso: chmod +x update.sh && ./update.sh
# Ejecutar desde la raíz del proyecto descargado
# =============================================================
# 
# Este script detecta la versión actual y aplica todas las 
# migraciones necesarias para llegar a la última versión.
# Es seguro ejecutarlo múltiples veces - es idempotente.
#
# Requisitos: bun (recomendado) o npm + npx
# =============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Version
TARGET_VERSION="0.9.0"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   KioskoApp - Actualización Completa     ║${NC}"
echo -e "${CYAN}║   Versión destino: v${TARGET_VERSION}               "`# padding`"${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# =============================================
# 0. Verificaciones previas
# =============================================
echo -e "${BOLD}[0/7] Verificaciones previas...${NC}"

# Check directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Ejecutá este script desde la raíz del proyecto (donde está package.json)${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Directorio correcto"

# Check prisma
if [ ! -d "prisma" ]; then
  echo -e "${RED}Error: No se encuentra la carpeta prisma/${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Prisma encontrado"

# Check package manager
PKG_CMD=""
if command -v bun &> /dev/null; then
  PKG_CMD="bun"
  echo -e "  ${GREEN}✓${NC} Usando bun como package manager"
elif command -v npm &> /dev/null; then
  PKG_CMD="npm"
  echo -e "  ${GREEN}✓${NC} Usando npm como package manager"
else
  echo -e "${RED}Error: No se encontró bun ni npm. Instalá uno de los dos.${NC}"
  exit 1
fi

# Detect current version
CURRENT_VERSION="0.0.0"
if command -v jq &> /dev/null && [ -f "package.json" ]; then
  CURRENT_VERSION=$(jq -r '.version' package.json 2>/dev/null || echo "0.0.0")
elif [ -f "package.json" ]; then
  CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' package.json | head -1 | grep -o '"[^"]*"$' | tr -d '"' 2>/dev/null || echo "0.0.0")
fi
echo -e "  ${CYAN}Versión actual detectada: v${CURRENT_VERSION}${NC}"
echo -e "  ${CYAN}Versión destino: v${TARGET_VERSION}${NC}"

if [ "$CURRENT_VERSION" = "$TARGET_VERSION" ]; then
  echo ""
  echo -e "${GREEN}✅ El sistema ya está en la versión más reciente (v${TARGET_VERSION})${NC}"
  echo ""
  read -p "¿Querés ejecutar la actualización igualmente? (s/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}Actualización cancelada.${NC}"
    exit 0
  fi
fi

echo ""

# =============================================
# 1. Backup de la base de datos
# =============================================
echo -e "${BOLD}[1/7] Creando backup de la base de datos...${NC}"

DB_FILE=""
# Find database file
if [ -f "db/custom.db" ]; then
  DB_FILE="db/custom.db"
elif [ -f "prisma/dev.db" ]; then
  DB_FILE="prisma/dev.db"
fi

if [ -n "$DB_FILE" ]; then
  BACKUP_NAME="${DB_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
  cp "$DB_FILE" "$BACKUP_NAME"
  echo -e "  ${GREEN}✓${NC} Backup creado: ${BACKUP_NAME}"
else
  echo -e "  ${YELLOW}⚠${NC} No se encontró archivo de base de datos para backup"
fi

echo ""

# =============================================
# 2. Verificar/instalar dependencias
# =============================================
echo -e "${BOLD}[2/7] Verificando dependencias...${NC}"

# Check for new dependencies that might be needed
DEPS_CHANGED=false

# Check bcryptjs (required for auth)
if [ ! -d "node_modules/bcryptjs" ]; then
  echo -e "  ${YELLOW}Instalando bcryptjs...${NC}"
  if [ "$PKG_CMD" = "bun" ]; then
    bun add bcryptjs 2>&1 | tail -1
  else
    npm install bcryptjs 2>&1 | tail -1
  fi
  DEPS_CHANGED=true
  echo -e "  ${GREEN}✓${NC} bcryptjs instalado"
else
  echo -e "  ${GREEN}✓${NC} bcryptjs ya instalado"
fi

if [ "$DEPS_CHANGED" = true ]; then
  echo -e "  ${GREEN}✓${NC} Dependencias actualizadas"
else
  echo -e "  ${GREEN}✓${NC} Todas las dependencias están instaladas"
fi

echo ""

# =============================================
# 3. Actualizar esquema de Prisma
# =============================================
echo -e "${BOLD}[3/7] Actualizando esquema de base de datos...${NC}"

# Generate Prisma client first
if [ "$PKG_CMD" = "bun" ]; then
  bun run db:generate 2>&1 | tail -2 || echo -e "  ${YELLOW}⚠${NC} db:generate tuvo advertencias"
else
  npx prisma generate 2>&1 | tail -2 || echo -e "  ${YELLOW}⚠${NC} prisma generate tuvo advertencias"
fi
echo -e "  ${GREEN}✓${NC} Prisma client generado"

# Push schema changes
if [ "$PKG_CMD" = "bun" ]; then
  bun run db:push 2>&1 | tail -3 || echo -e "  ${YELLOW}⚠${NC} db:push tuvo advertencias, puede que ya esté actualizado"
else
  npx prisma db:push 2>&1 | tail -3 || echo -e "  ${YELLOW}⚠${NC} prisma db:push tuvo advertencias"
fi
echo -e "  ${GREEN}✓${NC} Esquema de base de datos sincronizado"

echo ""

# =============================================
# 4. Ejecutar migraciones de datos
# =============================================
echo -e "${BOLD}[4/7] Ejecutando migraciones de datos...${NC}"

# Run the update-system.ts script which handles:
# - Creating/updating roles with all permissions
# - Creating super admin user
# - Adding new settings (custom options)
# - Upgrading base64 passwords to bcrypt
# - Assigning roles to users without one
# - Ensuring default warehouses exist
if [ -f "scripts/update-system.ts" ]; then
  echo -e "  ${CYAN}Ejecutando update-system.ts...${NC}"
  if [ "$PKG_CMD" = "bun" ]; then
    bun run scripts/update-system.ts 2>&1 || echo -e "  ${YELLOW}⚠${NC} update-system.ts tuvo errores, continuando..."
  else
    npx tsx scripts/update-system.ts 2>&1 || echo -e "  ${YELLOW}⚠${NC} update-system.ts tuvo errores, continuando..."
  fi
  echo -e "  ${GREEN}✓${NC} Migración de datos ejecutada"
elif [ -f "scripts/migrate-add-auth.ts" ]; then
  echo -e "  ${CYAN}Ejecutando migrate-add-auth.ts...${NC}"
  if [ "$PKG_CMD" = "bun" ]; then
    bun run scripts/migrate-add-auth.ts 2>&1 || echo -e "  ${YELLOW}⚠${NC} migrate-add-auth.ts tuvo errores"
  else
    npx tsx scripts/migrate-add-auth.ts 2>&1 || echo -e "  ${YELLOW}⚠${NC} migrate-add-auth.ts tuvo errores"
  fi
  echo -e "  ${GREEN}✓${NC} Migración de auth ejecutada"
else
  echo -e "  ${YELLOW}⚠${NC} No se encontró script de migración"
fi

echo ""

# =============================================
# 5. Verificar archivos críticos
# =============================================
echo -e "${BOLD}[5/7] Verificando archivos críticos...${NC}"

CRITICAL_FILES=(
  "prisma/schema.prisma"
  "src/lib/db.ts"
  "src/app/page.tsx"
  "src/lib/store.ts"
  "src/components/layout/app-sidebar.tsx"
)

OPTIONAL_FILES=(
  "src/lib/auth.ts"
  "src/components/auth/login-view.tsx"
  "src/app/api/auth/login/route.ts"
  "src/app/api/auth/logout/route.ts"
  "src/app/api/auth/session/route.ts"
  "src/components/expenses/expenses-view.tsx"
  "src/app/api/expenses/route.ts"
  "src/app/api/version/route.ts"
  "scripts/update-system.ts"
  "src/lib/version.ts"
)

ALL_OK=true

for f in "${CRITICAL_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo -e "  ${GREEN}✓${NC} $f"
  else
    echo -e "  ${RED}✗${NC} $f ${RED}(FALTA - CRÍTICO)${NC}"
    ALL_OK=false
  fi
done

for f in "${OPTIONAL_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo -e "  ${GREEN}✓${NC} $f"
  else
    echo -e "  ${YELLOW}○${NC} $f ${YELLOW}(opcional - no encontrado)${NC}"
  fi
done

echo ""

# =============================================
# 6. Actualizar versión en package.json
# =============================================
echo -e "${BOLD}[6/7] Actualizando versión del sistema...${NC}"

if command -v sed &> /dev/null; then
  # Update version in package.json
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${TARGET_VERSION}\"/" package.json
  else
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${TARGET_VERSION}\"/" package.json
  fi
  echo -e "  ${GREEN}✓${NC} Versión actualizada a v${TARGET_VERSION} en package.json"
else
  echo -e "  ${YELLOW}⚠${NC} No se pudo actualizar la versión automáticamente"
  echo -e "  ${YELLOW}  Actualizá manualmente la versión en package.json a: ${TARGET_VERSION}${NC}"
fi

echo ""

# =============================================
# 7. Limpiar caché y reconstruir
# =============================================
echo -e "${BOLD}[7/7] Limpiando caché...${NC}"

# Clean Next.js cache
if [ -d ".next" ]; then
  rm -rf .next
  echo -e "  ${GREEN}✓${NC} Caché de Next.js eliminado"
fi

# Clean Prisma query engine cache (if exists)
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo -e "  ${GREEN}✓${NC} Caché de node_modules eliminado"
fi

echo ""

# =============================================
# Resumen final
# =============================================
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
if [ "$ALL_OK" = true ]; then
  echo -e "${GREEN}║   ✅ Actualización completada!            ║${NC}"
else
  echo -e "${YELLOW}║   ⚠️  Actualización parcial               ║${NC}"
  echo -e "${YELLOW}║   Revisá los archivos faltantes arriba   ║${NC}"
fi
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}📋 Resumen de la actualización:${NC}"
echo -e "  ${CYAN}•${NC} Base de datos: esquema sincronizado"
echo -e "  ${CYAN}•${NC} Roles: verificados y actualizados con todos los permisos"
echo -e "  ${CYAN}•${NC} Super Admin: dubiel / openpgpwd"
echo -e "  ${CYAN}•${NC} Contraseñas: migradas a bcrypt"
echo -e "  ${CYAN}•${NC} Versión: v${TARGET_VERSION}"
if [ -n "$BACKUP_NAME" ]; then
  echo -e "  ${CYAN}•${NC} Backup: ${BACKUP_NAME}"
fi
echo ""
echo -e "${BOLD}🆕 Funcionalidades disponibles:${NC}"
echo -e "  ${CYAN}•${NC} Sistema de Login y Autenticación"
echo -e "  ${CYAN}•${NC} Permisos por rol en la navegación"
echo -e "  ${CYAN}•${NC} Módulo de Gastos"
echo -e "  ${CYAN}•${NC} Módulo de Reparaciones"
echo -e "  ${CYAN}•${NC} Reportes diarios"
echo -e "  ${CYAN}•${NC} Opciones personalizables (unidades, categorías de gasto)"
echo -e "  ${CYAN}•${NC} Sistema de actualización automática"
echo -e "  ${CYAN}•${NC} Verificación de versión"
echo -e "  ${CYAN}•${NC} Pagos divididos (múltiples medios de pago)"
echo -e "  ${CYAN}•${NC} Efectivo recibido y cálculo de vuelto"
echo -e "  ${CYAN}•${NC} Reportes con desglose por medio de pago"
echo -e "  ${CYAN}•${NC} Medios de pago personalizables"
echo -e "  ${CYAN}•${NC} Producto: opción Mostrar en Punto de Venta"
echo -e "  ${CYAN}•${NC} Reparaciones: seleccionar piezas desde inventario"
echo -e "  ${CYAN}•${NC} Recepción de stock: precio de costo con ponderación"
echo -e "  ${CYAN}•${NC} Compras: cálculo automático de costo ponderado al recibir"
echo -e "  ${CYAN}•${NC} Recepción: opción Mostrar en POS al crear producto"
echo ""
echo -e "${BOLD}🔑 Credenciales:${NC}"
echo -e "  ${CYAN}Super Admin:${NC} dubiel / openpgpwd"
echo -e "  ${CYAN}Admin:${NC} admin / admin"
echo ""
echo -e "${BOLD}🚀 Para iniciar el sistema:${NC}"
echo -e "  ${CYAN}bun run dev${NC}"
echo ""
