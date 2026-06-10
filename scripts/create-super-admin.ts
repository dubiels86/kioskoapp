/**
 * Script para crear el usuario Super Administrador "dubiel" con contraseña "openpgpwd"
 * 
 * Uso: bun run scripts/create-super-admin.ts
 * 
 * Este script:
 * 1. Crea o actualiza el rol "Super Administrador" con TODOS los permisos
 * 2. Crea el usuario "dubiel" con contraseña "openpgpwd" si no existe
 * 3. Si el usuario ya existe, actualiza su contraseña y le asigna el rol Super Administrador
 * 4. Asegura que el usuario esté activo
 */
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

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

async function createSuperAdmin() {
  console.log('🚀 Creando usuario Super Administrador...')
  console.log(`   Usuario: ${SUPER_ADMIN_USERNAME}`)
  console.log(`   Contraseña: ${SUPER_ADMIN_PASSWORD}`)
  console.log('')

  try {
    // 1. Crear o actualizar el rol "Super Administrador"
    let superAdminRole = await db.role.findFirst({
      where: { name: SUPER_ADMIN_ROLE_NAME },
    })

    if (superAdminRole) {
      // Actualizar permisos del rol existente
      superAdminRole = await db.role.update({
        where: { id: superAdminRole.id },
        data: {
          permissions: JSON.stringify(ALL_PERMISSIONS),
          description: 'Acceso total al sistema - Super Administrador',
          isActive: true,
        },
      })
      console.log(`  ✅ Rol "${SUPER_ADMIN_ROLE_NAME}" actualizado con todos los permisos`)
    } else {
      // Crear el rol
      superAdminRole = await db.role.create({
        data: {
          name: SUPER_ADMIN_ROLE_NAME,
          description: 'Acceso total al sistema - Super Administrador',
          permissions: JSON.stringify(ALL_PERMISSIONS),
          isActive: true,
        },
      })
      console.log(`  ✅ Rol "${SUPER_ADMIN_ROLE_NAME}" creado con todos los permisos`)
    }

    // 2. Crear o actualizar el usuario "dubiel"
    const existingUser = await db.user.findUnique({
      where: { username: SUPER_ADMIN_USERNAME },
    })

    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10)

    if (existingUser) {
      // Actualizar usuario existente
      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          name: SUPER_ADMIN_NAME,
          roleId: superAdminRole.id,
          isActive: true,
        },
        include: { role: true },
      })
      console.log(`  ✅ Usuario "${SUPER_ADMIN_USERNAME}" actualizado`)
      console.log(`     - Nombre: ${updatedUser.name}`)
      console.log(`     - Rol: ${updatedUser.role.name}`)
      console.log(`     - Activo: ${updatedUser.isActive}`)
    } else {
      // Crear nuevo usuario
      const newUser = await db.user.create({
        data: {
          username: SUPER_ADMIN_USERNAME,
          password: hashedPassword,
          name: SUPER_ADMIN_NAME,
          email: 'dubiel@kioskoapp.com',
          roleId: superAdminRole.id,
          isActive: true,
        },
        include: { role: true },
      })
      console.log(`  ✅ Usuario "${SUPER_ADMIN_USERNAME}" creado`)
      console.log(`     - Nombre: ${newUser.name}`)
      console.log(`     - Rol: ${newUser.role.name}`)
      console.log(`     - Email: ${newUser.email}`)
      console.log(`     - Activo: ${newUser.isActive}`)
    }

    // 3. Verificación - intentar leer el usuario para confirmar
    const verifyUser = await db.user.findUnique({
      where: { username: SUPER_ADMIN_USERNAME },
      include: { role: true },
    })

    if (verifyUser && verifyUser.isActive && verifyUser.role.name === SUPER_ADMIN_ROLE_NAME) {
      console.log('')
      console.log('✅ Super Administrador verificado correctamente')
      console.log(`   Credenciales de acceso:`)
      console.log(`   👤 Usuario: ${SUPER_ADMIN_USERNAME}`)
      console.log(`   🔑 Contraseña: ${SUPER_ADMIN_PASSWORD}`)
      console.log(`   🛡️  Rol: ${SUPER_ADMIN_ROLE_NAME}`)
      console.log(`   📋 Permisos: ${ALL_PERMISSIONS.length} permisos asignados`)
    } else {
      console.log('')
      console.log('⚠️  Advertencia: No se pudo verificar el usuario correctamente')
    }

  } catch (error) {
    console.error('❌ Error al crear Super Administrador:', error)
    process.exit(1)
  }

  console.log('')
  console.log('🎉 Script completado exitosamente')
}

createSuperAdmin()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
