/**
 * Migration script to add default roles and admin user to an existing KioskoApp database.
 * Run with: bun run scripts/migrate-add-auth.ts
 */
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

async function migrate() {
  console.log('🔄 Running auth migration...')

  // 1. Create default roles if they don't exist
  const existingRoles = await db.role.findMany()
  const existingRoleNames = new Set(existingRoles.map(r => r.name))

  const rolesToCreate = [
    {
      name: 'Administrador',
      description: 'Acceso total al sistema',
      permissions: JSON.stringify([
        'pos.access', 'pos.refund',
        'inventory.access', 'inventory.manage',
        'purchases.access', 'purchases.manage',
        'expenses.access', 'expenses.manage',
        'cash.access', 'cash.open', 'cash.close',
        'repairs.access', 'repairs.manage',
        'reports.access',
        'settings.access', 'settings.users', 'settings.roles', 'settings.all',
      ]),
    },
    {
      name: 'Vendedor',
      description: 'Acceso a ventas y consultas básicas',
      permissions: JSON.stringify([
        'pos.access',
        'cash.access', 'cash.open',
        'repairs.access',
      ]),
    },
    {
      name: 'Cajero',
      description: 'Acceso a punto de venta y caja',
      permissions: JSON.stringify([
        'pos.access',
        'cash.access', 'cash.open', 'cash.close',
        'expenses.access',
      ]),
    },
    {
      name: 'Depósito',
      description: 'Acceso a inventario y compras',
      permissions: JSON.stringify([
        'inventory.access', 'inventory.manage',
        'purchases.access', 'purchases.manage',
      ]),
    },
  ]

  let adminRole = existingRoles.find(r => r.name === 'Administrador')

  for (const roleData of rolesToCreate) {
    if (!existingRoleNames.has(roleData.name)) {
      const role = await db.role.create({ data: roleData })
      console.log(`  ✅ Rol creado: ${roleData.name}`)
      if (roleData.name === 'Administrador') adminRole = role
    } else {
      console.log(`  ⏭️  Rol ya existe: ${roleData.name}`)
    }
  }

  // 2. Create default admin user if no users exist
  const existingUsers = await db.user.findMany()

  if (existingUsers.length === 0) {
    if (!adminRole) {
      adminRole = await db.role.findFirst({ where: { name: 'Administrador' } })
    }

    if (adminRole) {
      const adminPassword = await bcrypt.hash('admin', 10)
      await db.user.create({
        data: {
          username: 'admin',
          password: adminPassword,
          name: 'Administrador',
          email: 'admin@kioskoapp.com',
          roleId: adminRole.id,
          isActive: true,
        },
      })
      console.log('  ✅ Usuario admin creado (usuario: admin, contraseña: admin)')
    } else {
      console.log('  ⚠️  No se encontró el rol Administrador, no se pudo crear el usuario admin')
    }
  } else {
    console.log(`  ⏭️  Ya existen ${existingUsers.length} usuarios, omitiendo creación de admin`)

    // 3. Upgrade existing base64 passwords to bcrypt
    let upgraded = 0
    for (const user of existingUsers) {
      // If password doesn't start with $2 (bcrypt), it's base64-encoded
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
        // Decode the base64 password to get the original plain text
        const plainPassword = Buffer.from(user.password, 'base64').toString('utf-8')
        const newHash = await bcrypt.hash(plainPassword, 10)
        await db.user.update({
          where: { id: user.id },
          data: { password: newHash },
        })
        upgraded++
      }
    }
    if (upgraded > 0) {
      console.log(`  ✅ ${upgraded} contraseñas actualizadas de base64 a bcrypt`)
    }
  }

  // 4. Ensure all users without a role get the first available role
  const usersWithoutRole = await db.user.findMany({
    where: { roleId: '' },
  })

  if (usersWithoutRole.length > 0 && adminRole) {
    for (const user of usersWithoutRole) {
      await db.user.update({
        where: { id: user.id },
        data: { roleId: adminRole.id },
      })
    }
    console.log(`  ✅ ${usersWithoutRole.length} usuarios sin rol asignados al rol Administrador`)
  }

  console.log('✅ Auth migration completed!')
}

migrate()
  .catch((e) => {
    console.error('Migration error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
