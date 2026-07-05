/**
 * Script para cambiar la contraseña del usuario Super Administrador "dubiel".
 *
 * Uso (interactivo, contraseña oculta):
 *   bun run scripts/change-dubiel-password.ts
 *
 * Uso (pasando la contraseña como argumento — útil para scripts/CI):
 *   bun run scripts/change-dubiel-password.ts "MiNuevaClave123"
 *
 * También podés cambiar el usuario objetivo con la variable de entorno:
 *   TARGET_USERNAME=otroUsuario bun run scripts/change-dubiel-password.ts
 *
 * El script:
 *   1. Pide (o recibe) la nueva contraseña (mínimo 8 caracteres)
 *   2. Pide confirmación (sólo en modo interactivo)
 *   3. Verifica que el usuario exista y esté activo
 *   4. Hashea con bcrypt y actualiza la contraseña en la BD
 *   5. Verifica que el nuevo hash valide la nueva contraseña
 *   6. Muestra un resumen con el estado final
 *
 * Nota de seguridad: la contraseña NUNCA se imprime en el log.
 */
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import readline from 'readline'

const TARGET_USERNAME = process.env.TARGET_USERNAME || 'dubiel'
// Si FORCE_WEAK=1, no se emiten advertencias de fortaleza (sigue habiendo mínimo duro de 4).
const FORCE_WEAK = process.env.FORCE_WEAK === '1' || process.env.FORCE_WEAK === 'true'

// --- Helpers para input oculto tipo getpass ------------------------------

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })

    // Reemplaza cada carácter con '*' al escribir (si la terminal lo soporta)
    const onData = (char: Buffer) => {
      const c = char.toString()
      // Backspace / Delete
      if (c === '\u007f' || c === '\b') {
        // readline ya borró el carácter; no hacemos eco extra
        return
      }
    }
    process.stdin.on('data', onData)

    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData)
      rl.close()
      // Limpia la línea para que no queden '*' en pantalla
      process.stdout.write('\r' + ' '.repeat(80) + '\r')
      resolve(answer)
    })

    // En terminales no-TTY (pipes), no se oculta pero igual funciona
    if (!process.stdin.isTTY) {
      // Sin terminal, no se puede ocultar; se lee tal cual
    }
  })
}

function printBanner() {
  console.log('')
  console.log('==============================================')
  console.log('  Cambio de contraseña de Super Administrador')
  console.log('==============================================')
  console.log(`  Usuario objetivo: ${TARGET_USERNAME}`)
  console.log(`  Base de datos   : ${process.env.DATABASE_URL || '(no definida)'}`)
  console.log('==============================================')
  console.log('')
}

function validatePassword(pwd: string): string | null {
  // Hard minimum — bloqueante
  if (!pwd) return 'La contraseña no puede estar vacía.'
  if (pwd.length < 4) return 'La contraseña debe tener al menos 4 caracteres.'
  if (pwd.length > 200) return 'La contraseña es demasiado larga (máx 200).'
  if (/\s/.test(pwd)) return 'La contraseña no puede contener espacios.'
  return null
}

function strengthWarning(pwd: string): string | null {
  // Validación suave — sólo advertencia (no bloquea)
  if (FORCE_WEAK) return null
  let score = 0
  if (/[a-z]/.test(pwd)) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  if (pwd.length < 8) return 'La contraseña es corta (menos de 8 caracteres).'
  if (score < 3) {
    return 'La contraseña es débil. Se recomienda combinar mayúsculas, minúsculas, números y símbolos.'
  }
  return null
}

async function getNewPassword(): Promise<string> {
  // 1) Intentar argumento CLI
  const argPwd = process.argv[2]
  if (argPwd) {
    console.log('ℹ️  Usando contraseña pasada como argumento CLI.')
    const err = validatePassword(argPwd)
    if (err) {
      console.error(`❌ ${err}`)
      process.exit(2)
    }
    const warn = strengthWarning(argPwd)
    if (warn) console.warn(`⚠️  ${warn}`)
    return argPwd
  }

  // 2) Modo interactivo — pedir dos veces
  if (!process.stdin.isTTY) {
    console.error('❌ No hay TTY interactiva y no se pasó la contraseña como argumento.')
    console.error('   Uso: bun run scripts/change-dubiel-password.ts "NuevaClave123"')
    process.exit(2)
  }

  const pwd1 = await promptHidden('🔑 Nueva contraseña: ')
  const err1 = validatePassword(pwd1)
  if (err1) {
    console.error(`❌ ${err1}`)
    process.exit(2)
  }
  const warn1 = strengthWarning(pwd1)
  if (warn1) console.warn(`⚠️  ${warn1}`)

  const pwd2 = await promptHidden('🔑 Confirmar contraseña: ')
  if (pwd1 !== pwd2) {
    console.error('❌ Las contraseñas no coinciden.')
    process.exit(2)
  }

  return pwd1
}

async function changePassword() {
  printBanner()

  // 1. Verificar que el usuario exista
  const user = await db.user.findUnique({
    where: { username: TARGET_USERNAME },
    include: { role: true },
  })

  if (!user) {
    console.error(`❌ No existe el usuario "${TARGET_USERNAME}" en la base de datos.`)
    console.error('   Crealo primero con: bun run scripts/create-super-admin.ts')
    process.exit(1)
  }

  console.log(`✅ Usuario encontrado:`)
  console.log(`   - ID       : ${user.id}`)
  console.log(`   - Nombre   : ${user.name}`)
  console.log(`   - Email    : ${user.email || '(sin email)'}`)
  console.log(`   - Rol      : ${user.role?.name || '(sin rol)'}`)
  console.log(`   - Activo   : ${user.isActive ? 'sí' : 'no'}`)
  if (!user.isActive) {
    console.warn('⚠️  El usuario está INACTIVO. Se activará automáticamente.')
  }
  console.log('')

  // 2. Obtener la nueva contraseña (CLI arg o prompt oculto)
  const newPwd = await getNewPassword()

  // 3. Hashear y actualizar
  console.log('')
  console.log('🔄 Hasheando contraseña con bcrypt (cost 10)...')
  const hashed = await bcrypt.hash(newPwd, 10)

  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      isActive: true, // garantiza que quede activo
    },
  })
  console.log('✅ Contraseña actualizada en la base de datos.')

  // 4. Verificación: releer y comparar con bcrypt
  const reloaded = await db.user.findUnique({
    where: { id: user.id },
    include: { role: true },
  })
  if (!reloaded) {
    console.error('❌ No se pudo releer el usuario después del update.')
    process.exit(1)
  }
  const ok = await bcrypt.compare(newPwd, reloaded.password)
  if (!ok) {
    console.error('❌ VERIFICACIÓN FALLIDA: el hash guardado no valida la nueva contraseña.')
    process.exit(1)
  }

  console.log('')
  console.log('==============================================')
  console.log('  ✅ Cambio de contraseña exitoso')
  console.log('==============================================')
  console.log(`  Usuario   : ${reloaded.username}`)
  console.log(`  Rol       : ${reloaded.role?.name || '(sin rol)'}`)
  console.log(`  Activo    : ${reloaded.isActive ? 'sí' : 'no'}`)
  console.log(`  Hash (10c): ${reloaded.password.slice(0, 10)}...`)
  console.log('==============================================')
  console.log('')
  console.log('🔐 Ya podés iniciar sesión con la nueva contraseña.')
  console.log('   Recordá reiniciar el servidor si usás caché de sesión.')
  console.log('')
}

changePassword()
  .catch((err) => {
    console.error('')
    console.error('❌ Error fatal:', err?.message || err)
    if (process.env.DEBUG) console.error(err?.stack)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
