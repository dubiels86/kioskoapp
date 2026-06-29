#!/usr/bin/env tsx
/**
 * Script para verificar permisos del rol de administrador
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPermissions() {
  console.log('🔍 Verificando permisos del rol Administrador...\n')

  try {
    const adminRole = await prisma.role.findFirst({
      where: { name: 'Administrador' },
      include: { users: true }
    })
    
    if (!adminRole) {
      console.log('❌ Rol Administrador no encontrado')
      return
    }
    
    console.log('✅ Rol Administrador encontrado:')
    console.log(`ID: ${adminRole.id}`)
    console.log(`Nombre: ${adminRole.name}`)
    console.log(`Descripción: ${adminRole.description}`)
    console.log(`Permisos: ${adminRole.permissions}`)
    console.log(`Activo: ${adminRole.isActive}`)
    
    console.log('\n👥 Usuarios con este rol:')
    if (adminRole.users.length === 0) {
      console.log('❌ No hay usuarios con este rol')
    } else {
      adminRole.users.forEach(user => {
        console.log(`- ${user.username} (${user.name}) - Activo: ${user.isActive}`)
      })
    }
    
    // Verificar si los permisos son válidos JSON
    try {
      const permissions = JSON.parse(adminRole.permissions)
      console.log(`\n✅ Permisos parseados correctamente:`, permissions)
    } catch (error) {
      console.log(`\n❌ Error parseando permisos: ${error}`)
      console.log('Los permisos deben ser un JSON array válido')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkPermissions()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })