#!/usr/bin/env tsx
/**
 * Script para crear usuario administrador inicial
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdminUser() {
  console.log('👑 Creando usuario administrador...\n')

  try {
    // Primero, verificar si ya existe un rol de administrador
    let adminRole = await prisma.role.findFirst({
      where: { name: 'Administrador' }
    })

    if (!adminRole) {
      // Crear rol de administrador
      adminRole = await prisma.role.create({
        data: {
          name: 'Administrador',
          description: 'Administrador del sistema con todos los permisos',
          permissions: JSON.stringify(['*']) // Todos los permisos
        }
      })
      console.log(`✅ Rol creado: ${adminRole.name}`)
    } else {
      console.log(`✅ Rol existente: ${adminRole.name}`)
    }

    // Verificar si ya existe el usuario dubiel
    const existingUser = await prisma.user.findUnique({
      where: { username: 'dubiel' }
    })

    if (existingUser) {
      console.log(`⚠️  Usuario "dubiel" ya existe`)
      console.log(`Puedes cambiar su contraseña con:`)
      console.log(`npx tsx scripts/change-user-password.ts dubiel nueva_contraseña`)
      return existingUser
    }

    // Hashear la contraseña
    const password = 'openpgpwd'
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Crear usuario administrador
    const adminUser = await prisma.user.create({
      data: {
        username: 'dubiel',
        password: hashedPassword,
        name: 'Usuario Administrador',
        email: 'admin@kiosko.app',
        phone: '',
        roleId: adminRole.id,
        isActive: true
      }
    })

    console.log(`✅ Usuario creado exitosamente:`)
    console.log(`- Usuario: ${adminUser.username}`)
    console.log(`- Nombre: ${adminUser.name}`)
    console.log(`- Contraseña: ${password}`)
    console.log(`- Rol: ${adminRole.name}`)
    console.log(`\n⚠️  IMPORTANTE: Guarda esta contraseña de forma segura`)
    console.log(`\nPuedes iniciar sesión con:`)
    console.log(`Usuario: dubiel`)
    console.log(`Contraseña: ${password}`)

    return adminUser

  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error)
  }
}

async function main() {
  // También crear otros roles básicos si no existen
  const basicRoles = [
    { name: 'Vendedor', description: 'Vendedor con permisos limitados', permissions: ['ver_productos', 'crear_ventas', 'ver_inventario'] },
    { name: 'Almacenero', description: 'Encargado de inventario', permissions: ['ver_productos', 'gestionar_inventario', 'ver_reportes'] },
    { name: 'Gerente', description: 'Gerente con permisos avanzados', permissions: ['*'] }
  ]

  for (const roleData of basicRoles) {
    const existingRole = await prisma.role.findFirst({
      where: { name: roleData.name }
    })

    if (!existingRole) {
      await prisma.role.create({
        data: {
          ...roleData,
          permissions: JSON.stringify(roleData.permissions)
        }
      })
      console.log(`✅ Rol creado: ${roleData.name}`)
    }
  }

  await createAdminUser()
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })