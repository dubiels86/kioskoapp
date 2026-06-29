#!/usr/bin/env tsx
/**
 * Script para listar usuarios en la base de datos
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listUsers() {
  console.log('👥 Listando usuarios en la base de datos...\n')

  try {
    const users = await prisma.user.findMany({
      include: {
        role: true
      },
      orderBy: { username: 'asc' }
    })

    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos')
      console.log('\nPuedes crear un usuario con:')
      console.log('npx tsx scripts/create-admin-user.ts')
    } else {
      console.log(`✅ Encontrados ${users.length} usuarios:\n`)
      
      users.forEach(user => {
        console.log(`- ${user.username} (${user.name})`)
        console.log(`  ID: ${user.id}`)
        console.log(`  Email: ${user.email || 'No especificado'}`)
        console.log(`  Rol: ${user.role?.name || 'Sin rol'}`)
        console.log(`  Activo: ${user.isActive ? '✅' : '❌'}`)
        console.log(`  Último login: ${user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Nunca'}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('❌ Error listando usuarios:', error)
  }
}

listUsers()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })