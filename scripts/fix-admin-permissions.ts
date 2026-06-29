#!/usr/bin/env tsx
/**
 * Script para arreglar los permisos del rol Administrador
 * Agrega todos los permisos de acceso a los módulos
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAdminPermissions() {
  console.log('🔧 Arreglando permisos del rol Administrador...\n')

  try {
    // Permisos necesarios para todos los módulos
    const allPermissions = [
      // Permisos generales
      '*', // Todos los permisos
      
      // Permisos específicos de módulos (como están definidos en AppSidebar)
      'pos.access',
      'inventory.access',
      'purchases.access',
      'expenses.access',
      'cash.access',
      'repairs.access',
      'reports.access',
      'settings.access',
      
      // Permisos adicionales para funcionalidades específicas
      'settings.all',
      'pos.create_sale',
      'pos.manage_cart',
      'inventory.view',
      'inventory.manage',
      'inventory.receive_stock',
      'inventory.transfer_stock',
      'purchases.create',
      'purchases.view',
      'expenses.create',
      'expenses.view',
      'cash.open',
      'cash.close',
      'cash.view_movements',
      'repairs.create',
      'repairs.view',
      'repairs.update_status',
      'reports.view',
      'reports.generate',
      'settings.manage_users',
      'settings.manage_roles',
      'settings.manage_currencies',
      'settings.manage_denominations',
      'settings.view_audit_log'
    ]

    // Encontrar el rol Administrador
    const adminRole = await prisma.role.findFirst({
      where: { name: 'Administrador' }
    })

    if (!adminRole) {
      console.log('❌ Rol Administrador no encontrado')
      return
    }

    console.log(`✅ Rol Administrador encontrado: ${adminRole.name}`)
    console.log(`Permisos actuales: ${adminRole.permissions}`)

    // Actualizar con todos los permisos
    const updatedRole = await prisma.role.update({
      where: { id: adminRole.id },
      data: {
        permissions: JSON.stringify(allPermissions)
      }
    })

    console.log(`\n✅ Permisos actualizados exitosamente`)
    console.log(`Nuevos permisos: ${updatedRole.permissions}`)
    
    // Parsear y mostrar los permisos
    try {
      const parsedPermissions = JSON.parse(updatedRole.permissions)
      console.log(`\nPermisos parseados (${parsedPermissions.length} total):`)
      parsedPermissions.forEach((perm: string, index: number) => {
        console.log(`${index + 1}. ${perm}`)
      })
    } catch (error) {
      console.log(`\n⚠️  Error parseando permisos: ${error}`)
    }

    // Verificar usuarios con este rol
    const usersWithRole = await prisma.user.findMany({
      where: { roleId: adminRole.id },
      include: { role: true }
    })

    console.log(`\n👥 Usuarios con rol Administrador (${usersWithRole.length}):`)
    usersWithRole.forEach(user => {
      console.log(`- ${user.username} (${user.name}) - Activo: ${user.isActive}`)
    })

    console.log('\n🎉 Permisos arreglados! El usuario dubiel ahora tiene acceso a todos los módulos.')
    console.log('\nReinicia la aplicación o refresca la página para ver los cambios.')

  } catch (error) {
    console.error('❌ Error arreglando permisos:', error)
  }
}

fixAdminPermissions()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })