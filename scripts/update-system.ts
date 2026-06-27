/**
 * Script de actualización para sistema KioskoApp descargado
 * 
 * Uso: bun run scripts/update-system.ts
 * 
 * Este script:
 * 1. Verifica que la base de datos existe y es accesible
 * 2. Asegura que los roles por defecto existan con todos los permisos
 * 3. Crea o actualiza el usuario Super Administrador "dubiel"
 * 4. Agrega las configuraciones de opciones personalizadas (unidades, categorías de gasto, métodos de pago)
 * 5. Actualiza contraseñas base64 legacy a bcrypt
 * 6. Verifica la integridad del sistema
 * 7. Registra la versión del sistema en la base de datos
 */
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

const APP_VERSION = '0.9.0'

const SUPER_ADMIN_USERNAME = 'dubiel'
const SUPER_ADMIN_PASSWORD = 'openpgpwd'
const SUPER_ADMIN_NAME = 'Dubiel'
const SUPER_ADMIN_ROLE_NAME = 'Super Administrador'

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

const DEFAULT_ROLES = [
  {
    name: 'Administrador',
    description: 'Acceso total al sistema',
    permissions: JSON.stringify(ALL_PERMISSIONS),
  },
  {
    name: 'Vendedor',
    description: 'Acceso a ventas y consultas básicas',
    permissions: JSON.stringify(['pos.access', 'cash.access', 'cash.open', 'repairs.access']),
  },
  {
    name: 'Cajero',
    description: 'Acceso a punto de venta y caja',
    permissions: JSON.stringify(['pos.access', 'cash.access', 'cash.open', 'cash.close', 'expenses.access']),
  },
  {
    name: 'Depósito',
    description: 'Acceso a inventario y compras',
    permissions: JSON.stringify(['inventory.access', 'inventory.manage', 'purchases.access', 'purchases.manage']),
  },
]

// New settings for custom options (creatable selects)
const NEW_SETTINGS = [
  { key: 'custom_units', value: '[]', label: 'Unidades Personalizadas', group: 'custom_options' },
  { key: 'custom_expense_categories', value: '[]', label: 'Categorías de Gasto Personalizadas', group: 'custom_options' },
  { key: 'custom_expense_payment_methods', value: '[]', label: 'Métodos de Pago de Gastos Personalizados', group: 'custom_options' },
  { key: 'custom_payment_methods', value: '[]', label: 'Métodos de Pago Personalizados (POS)', group: 'custom_options' },
  { key: 'custom_repair_brands', value: '[]', label: 'Marcas de Reparación Personalizadas', group: 'custom_options' },
  { key: 'custom_repair_devices', value: '[]', label: 'Dispositivos de Reparación Personalizados', group: 'custom_options' },
  { key: 'custom_warehouse_types', value: '[]', label: 'Tipos de Depósito Personalizados', group: 'custom_options' },
]

async function updateSystem() {
  console.log('🔄 Actualizando sistema KioskoApp...')
  console.log('=' .repeat(50))
  console.log('')

  try {
    // ========================================
    // 1. Verificar conexión a la base de datos
    // ========================================
    console.log('📦 Verificando base de datos...')
    try {
      await db.$queryRaw`SELECT 1`
      console.log('  ✅ Base de datos accesible')
    } catch {
      console.error('  ❌ No se puede acceder a la base de datos')
      process.exit(1)
    }

    // ========================================
    // 2. Asegurar roles por defecto
    // ========================================
    console.log('')
    console.log('🛡️  Verificando roles del sistema...')
    const existingRoles = await db.role.findMany()
    const existingRoleNames = new Set(existingRoles.map(r => r.name))

    for (const roleData of DEFAULT_ROLES) {
      if (!existingRoleNames.has(roleData.name)) {
        await db.role.create({ data: { ...roleData, isActive: true } })
        console.log(`  ✅ Rol creado: ${roleData.name}`)
      } else {
        // Update permissions for existing roles
        const existing = existingRoles.find(r => r.name === roleData.name)
        if (existing) {
          await db.role.update({
            where: { id: existing.id },
            data: { permissions: roleData.permissions, isActive: true },
          })
          console.log(`  ✅ Rol actualizado: ${roleData.name}`)
        }
      }
    }

    // ========================================
    // 3. Crear/actualizar Super Administrador
    // ========================================
    console.log('')
    console.log('👤 Configurando Super Administrador...')

    let superAdminRole = await db.role.findFirst({ where: { name: SUPER_ADMIN_ROLE_NAME } })
    if (!superAdminRole) {
      superAdminRole = await db.role.create({
        data: {
          name: SUPER_ADMIN_ROLE_NAME,
          description: 'Acceso total al sistema - Super Administrador',
          permissions: JSON.stringify(ALL_PERMISSIONS),
          isActive: true,
        },
      })
      console.log(`  ✅ Rol "${SUPER_ADMIN_ROLE_NAME}" creado`)
    } else {
      superAdminRole = await db.role.update({
        where: { id: superAdminRole.id },
        data: {
          permissions: JSON.stringify(ALL_PERMISSIONS),
          isActive: true,
        },
      })
      console.log(`  ✅ Rol "${SUPER_ADMIN_ROLE_NAME}" actualizado`)
    }

    const existingUser = await db.user.findUnique({ where: { username: SUPER_ADMIN_USERNAME } })
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10)

    if (existingUser) {
      await db.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword, name: SUPER_ADMIN_NAME, roleId: superAdminRole.id, isActive: true },
      })
      console.log(`  ✅ Usuario "${SUPER_ADMIN_USERNAME}" actualizado`)
    } else {
      await db.user.create({
        data: {
          username: SUPER_ADMIN_USERNAME,
          password: hashedPassword,
          name: SUPER_ADMIN_NAME,
          email: 'dubiel@kioskoapp.com',
          roleId: superAdminRole.id,
          isActive: true,
        },
      })
      console.log(`  ✅ Usuario "${SUPER_ADMIN_USERNAME}" creado`)
    }
    console.log(`     👤 Usuario: ${SUPER_ADMIN_USERNAME}`)
    console.log(`     🔑 Contraseña: ${SUPER_ADMIN_PASSWORD}`)
    console.log(`     🛡️  Rol: ${SUPER_ADMIN_ROLE_NAME}`)

    // ========================================
    // 4. Agregar nuevas configuraciones
    // ========================================
    console.log('')
    console.log('⚙️  Actualizando configuraciones...')
    for (const setting of NEW_SETTINGS) {
      const existing = await db.setting.findUnique({ where: { key: setting.key } })
      if (!existing) {
        await db.setting.create({ data: setting })
        console.log(`  ✅ Configuración creada: ${setting.label} (${setting.key})`)
      } else {
        console.log(`  ⏭️  Ya existe: ${setting.label}`)
      }
    }

    // ========================================
    // 5. Actualizar contraseñas base64 a bcrypt
    // ========================================
    console.log('')
    console.log('🔐 Verificando contraseñas...')
    const allUsers = await db.user.findMany()
    let upgraded = 0
    for (const user of allUsers) {
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
        try {
          const plainPassword = Buffer.from(user.password, 'base64').toString('utf-8')
          const newHash = await bcrypt.hash(plainPassword, 10)
          await db.user.update({ where: { id: user.id }, data: { password: newHash } })
          upgraded++
        } catch {
          console.log(`  ⚠️  No se pudo migrar la contraseña del usuario ${user.username}`)
        }
      }
    }
    if (upgraded > 0) {
      console.log(`  ✅ ${upgraded} contraseñas actualizadas de base64 a bcrypt`)
    } else {
      console.log('  ✅ Todas las contraseñas ya están en formato bcrypt')
    }

    // ========================================
    // 6. Asegurar que los usuarios tengan rol asignado
    // ========================================
    console.log('')
    console.log('👥 Verificando usuarios sin rol...')
    const adminRole = await db.role.findFirst({ where: { name: 'Administrador' } })
    if (adminRole) {
      const usersWithoutValidRole = await db.user.findMany({
        where: { roleId: '' },
      })
      if (usersWithoutValidRole.length > 0) {
        for (const user of usersWithoutValidRole) {
          await db.user.update({
            where: { id: user.id },
            data: { roleId: adminRole.id },
          })
        }
        console.log(`  ✅ ${usersWithoutValidRole.length} usuarios sin rol asignados a Administrador`)
      } else {
        console.log('  ✅ Todos los usuarios tienen rol asignado')
      }
    }

    // ========================================
    // 7. Asegurar almacenes por defecto
    // ========================================
    console.log('')
    console.log('🏪 Verificando almacenes...')
    const warehouseCount = await db.warehouse.count()
    if (warehouseCount === 0) {
      await db.warehouse.createMany({
        data: [
          { name: 'Depósito Principal', code: 'PRINCIPAL', type: 'PRINCIPAL', address: 'Depósito principal de stock', isActive: true },
          { name: 'Local de Ventas', code: 'VENTAS', type: 'VENTAS', address: 'Local de atención al público', isActive: true },
        ],
      })
      console.log('  ✅ 2 almacenes por defecto creados')
    } else {
      console.log(`  ✅ ${warehouseCount} almacenes existentes`)
    }

    // ========================================
    // 8. Asegurar monedas por defecto
    // ========================================
    console.log('')
    console.log('💱 Verificando monedas...')
    const currencyCount = await db.currency.count()
    if (currencyCount === 0) {
      // Try to get current currency from settings
      const codeSetting = await db.setting.findUnique({ where: { key: 'currency_code' } })
      const symbolSetting = await db.setting.findUnique({ where: { key: 'currency_symbol' } })
      const localeSetting = await db.setting.findUnique({ where: { key: 'currency_locale' } })

      const code = codeSetting ? JSON.parse(codeSetting.value) : 'ARS'
      const symbol = symbolSetting ? JSON.parse(symbolSetting.value) : '$'
      const locale = localeSetting ? JSON.parse(localeSetting.value) : 'es-AR'

      // Get currency name from code
      const currencyNames: Record<string, string> = {
        ARS: 'Peso Argentino', USD: 'Dólar Estadounidense', EUR: 'Euro',
        BRL: 'Real Brasileño', MXN: 'Peso Mexicano', COP: 'Peso Colombiano',
        CLP: 'Peso Chileno', PEN: 'Sol Peruano', UYU: 'Peso Uruguayo',
        VES: 'Bolívar Venezolano', BOB: 'Boliviano', PYG: 'Guaraní Paraguayo',
        CUP: 'Peso Cubano', GBP: 'Libra Esterlina',
      }

      await db.currency.create({
        data: {
          code,
          name: currencyNames[code] || 'Moneda Principal',
          symbol,
          locale,
          isBase: true,
          exchangeRate: 1,
          isActive: true,
        },
      })
      console.log(`  ✅ Moneda principal creada: ${code} (${symbol})`)
    } else {
      console.log(`  ✅ ${currencyCount} monedas existentes`)
    }

    // ========================================
    // 9. Registrar versión del sistema
    // ========================================
    console.log('')
    console.log('🏷️  Registrando versión del sistema...')
    await db.setting.upsert({
      where: { key: 'app_version' },
      update: { value: `"${APP_VERSION}"` },
      create: { key: 'app_version', value: `"${APP_VERSION}"`, label: 'Versión del Sistema', group: 'system' },
    })
    await db.setting.upsert({
      where: { key: 'last_updated' },
      update: { value: `"${new Date().toISOString()}"` },
      create: { key: 'last_updated', value: `"${new Date().toISOString()}"`, label: 'Última Actualización', group: 'system' },
    })
    console.log(`  ✅ Versión registrada: v${APP_VERSION}`)

    // ========================================
    // Resumen final
    // ========================================
    console.log('')
    console.log('=' .repeat(50))
    console.log('✅ Actualización completada exitosamente!')
    console.log('')
    console.log('📋 Resumen:')
    console.log(`   🏷️  Versión: v${APP_VERSION}`)
    console.log(`   🛡️  Roles verificados y actualizados`)
    console.log(`   👤 Super Admin: ${SUPER_ADMIN_USERNAME} / ${SUPER_ADMIN_PASSWORD}`)
    console.log(`   ⚙️  Configuraciones de opciones personalizadas agregadas`)
    console.log(`   🔐 Contraseñas verificadas`)
    console.log('')
    console.log('🆕 Nuevas funcionalidades en esta versión:')
    console.log('   • Sistema de monedas múltiples')
    console.log('   • Tipos de cambio entre monedas')
    console.log('   • Selector de moneda en el sidebar')
    console.log('   • Historial de cambios de tipo de cambio')
    console.log('   • Conversión en tiempo real al visualizar precios')
    console.log('   • Moneda principal configurable')
    console.log('   • Pagos divididos (múltiples medios de pago por venta)')
    console.log('   • Efectivo recibido y cálculo de vuelto')
    console.log('   • Reportes con desglose por medio de pago (incluyendo MIXTO)')
    console.log('   • Botones rápidos de efectivo en cobro')
    console.log('   • Medios de pago personalizables')
    console.log('   • Producto: opción Mostrar en Punto de Venta')
    console.log('   • Reparaciones: seleccionar piezas desde inventario')
    console.log('   • Recepción de stock: precio de costo con ponderación')
    console.log('   • Compras: cálculo automático de precio de costo ponderado al recibir')
    console.log('   • Recepción: opción Mostrar en POS al crear producto')

  } catch (error) {
    console.error('')
    console.error('❌ Error durante la actualización:', error)
    process.exit(1)
  }

  console.log('')
  console.log('🎉 Script completado')
}

updateSystem()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
