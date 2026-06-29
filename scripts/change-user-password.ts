#!/usr/bin/env tsx
/**
 * Script para cambiar la contraseña de un usuario en la aplicación
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function changeUserPassword(username: string, newPassword: string) {
  console.log(`🔑 Cambiando contraseña para usuario: ${username}...\n`)

  try {
    // Buscar el usuario
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      console.log(`❌ Usuario "${username}" no encontrado`)
      
      // Verificar si hay usuarios en la base de datos
      const allUsers = await prisma.user.findMany()
      console.log(`\nUsuarios existentes:`)
      allUsers.forEach(u => {
        console.log(`- ${u.username} (${u.name}) - Activo: ${u.isActive}`)
      })
      
      return
    }

    console.log(`✅ Usuario encontrado: ${user.name} (${user.username})`)
    
    // Hashear la nueva contraseña
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)
    
    // Actualizar la contraseña
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })
    
    console.log(`✅ Contraseña cambiada exitosamente para ${username}`)
    console.log(`\nNueva contraseña: ${newPassword}`)
    console.log(`\n⚠️  Recuerda guardar esta contraseña de forma segura`)
    
  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error)
  }
}

async function main() {
  const username = process.argv[2] || 'dubiel'
  const newPassword = process.argv[3] || 'openpgpwd'
  
  await changeUserPassword(username, newPassword)
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })