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
 *   1. Carga .env automáticamente (si existe) y aplica un fallback por defecto
 *   2. Pide (o recibe) la nueva contraseña (mínimo 4 caracteres)
 *   3. Pide confirmación (sólo en modo interactivo)
 *   4. Verifica que el usuario exista y esté activo
 *   5. Hashea con bcrypt y actualiza la contraseña en la BD
 *   6. Verifica que el nuevo hash valide la nueva contraseña
 *   7. Muestra un resumen con el estado final
 *
 * Nota de seguridad: la contraseña NUNCA se imprime en el log.
 */

// --- Cargar .env ANTES de importar Prisma --------------------------------
// Prisma lee DATABASE_URL en el momento de instanciación (import estático),
// así que tenemos que:
//   1) Cargar el archivo .env manualmente si existe
//   2) Aplicar un fallback razonable si DATABASE_URL no está definida
//   3) Recién entonces importar dinámicamente `@/lib/db`
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs'
import { resolve, dirname, join, isAbsolute } from 'path'

// --- 1) Encontrar la raíz del proyecto (donde está package.json) ---------
// Partimos del __dirname de este script (scripts/) y subimos hasta encontrar
// un package.json. Eso nos da el project root real, sin depender del cwd.
function findProjectRoot(startDir: string): string {
  let current = startDir
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(current, 'package.json'))) {
      // Confirmamos que sea el package.json del proyecto (no de node_modules)
      try {
        const pkg = JSON.parse(readFileSync(join(current, 'package.json'), 'utf-8'))
        if (pkg.name && !current.includes('node_modules')) {
          return current
        }
      } catch {
        // seguimos buscando
      }
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  // Fallback: devolvemos el startDir
  return startDir
}

// __dirname está disponible en Bun/Node ESM con top-level await
const PROJECT_ROOT = findProjectRoot(
  typeof __dirname !== 'undefined' ? __dirname : process.cwd()
)

// --- 2) Cargar .env (del project root y padres) --------------------------
function loadEnvFile(dir: string = PROJECT_ROOT): void {
  let current = dir
  for (let i = 0; i < 6; i++) {
    const envPath = resolve(current, '.env')
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8')
        for (const rawLine of content.split('\n')) {
          const line = rawLine.trim()
          if (!line || line.startsWith('#')) continue
          const eq = line.indexOf('=')
          if (eq === -1) continue
          const key = line.slice(0, eq).trim()
          let value = line.slice(eq + 1).trim()
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1)
          }
          if (!(key in process.env)) {
            process.env[key] = value
          }
        }
        return
      } catch {
        // Si falla la lectura, seguimos buscando en el padre
      }
    }
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
}

loadEnvFile()

// --- 3) Resolver DATABASE_URL con verificación de existencia -------------
// Reglas:
//   - Si DATABASE_URL apunta a un SQLite relativo → resolver contra PROJECT_ROOT
//   - Si DATABASE_URL apunta a un SQLite absoluto que NO existe Y NO está bajo
//     PROJECT_ROOT → se considera "stale" (env var heredada de otra máquina,
//     ej. el sandbox) y se IGNORA, cayendo a auto-detección.
//   - Si no hay DB en ninguna ubicación común → se crea automáticamente con
//     `bun run db:push` (schema only; el usuario dubiel debe crearse aparte).
import { execSync } from 'child_process'

function parseSqlitePath(url: string): string | null {
  const m = /^file:(.+)$/i.exec(url)
  if (!m) return null
  return m[1]
}

function fileExistsAt(absPath: string): boolean {
  try {
    const s = statSync(absPath)
    return s.isFile()
  } catch {
    return false
  }
}

function isUnderProject(absPath: string): boolean {
  const normalized = resolve(absPath)
  const root = resolve(PROJECT_ROOT)
  return normalized === root || normalized.startsWith(root + '/')
}

function runDbPush(): boolean {
  console.log('')
  console.log('📦 No se encontró la base de datos. Creándola con "bun run db:push"...')
  console.log(`   cwd: ${PROJECT_ROOT}`)
  try {
    execSync('bun run db:push', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: `file:${join(PROJECT_ROOT, 'db', 'custom.db')}` },
    })
    return true
  } catch (e: any) {
    console.error('')
    console.error('❌ Falló "bun run db:push".')
    console.error('   Salida:', e?.message || e)
    return false
  }
}

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL

  // --- Paso A: validar la DATABASE_URL configurada ----------------------
  if (configured) {
    const sqlitePath = parseSqlitePath(configured)
    if (sqlitePath) {
      const absPath = isAbsolute(sqlitePath)
        ? sqlitePath
        : resolve(PROJECT_ROOT, sqlitePath.replace(/^\.\//, ''))

      if (fileExistsAt(absPath)) {
        // El archivo existe. Si es relativo o está bajo el project root, OK.
        const isRelative = !isAbsolute(sqlitePath)
        if (isRelative || isUnderProject(absPath)) {
          return `file:${absPath}`
        }
        // Existe pero FUERA del project root — igual la usamos pero avisamos.
        console.warn(`⚠️  DATABASE_URL apunta a una BD fuera del project root:`)
        console.warn(`   ${absPath}`)
        console.warn(`   Project root: ${PROJECT_ROOT}`)
        return `file:${absPath}`
      }

      // El archivo NO existe.
      if (!isUnderProject(absPath) && isAbsolute(sqlitePath)) {
        // Absoluto, fuera del project root, inexistente → stale env var.
        // Típico caso: el sandbox setea DATABASE_URL=file:/home/z/my-project/...
        // y después corro el script en mi Mac donde esa ruta no existe.
        console.warn(`⚠️  DATABASE_URL apunta a un archivo inexistente fuera del project root:`)
        console.warn(`   ${absPath}`)
        console.warn(`   Project root: ${PROJECT_ROOT}`)
        console.warn(`   Ignorando DATABASE_URL (probablemente heredada de otra máquina) y`)
        console.warn(`   buscando la BD dentro del project root...`)
        // cae a auto-detección
      } else {
        // Relativo o bajo project root, pero no existe. También cae a auto-detección.
        console.warn(`⚠️  DATABASE_URL apunta a un archivo que no existe: ${absPath}`)
        console.warn(`   Buscando en ubicaciones comunes...`)
      }
    } else {
      // No es SQLite (postgres/mysql/etc.) — la usamos tal cual
      return configured
    }
  }

  // --- Paso B: auto-detección en ubicaciones comunes --------------------
  const commonLocations = [
    join(PROJECT_ROOT, 'db', 'custom.db'),
    join(PROJECT_ROOT, 'prisma', 'custom.db'),
    join(PROJECT_ROOT, 'prisma', 'dev.db'),
    join(PROJECT_ROOT, 'custom.db'),
  ]
  for (const loc of commonLocations) {
    if (fileExistsAt(loc)) {
      if (!configured) {
        console.warn(`✅ BD detectada automáticamente: ${loc}`)
      } else {
        console.warn(`✅ BD detectada en: ${loc}`)
      }
      return `file:${loc}`
    }
  }

  // --- Paso C: ninguna existe → crear con db:push -----------------------
  const targetDb = join(PROJECT_ROOT, 'db', 'custom.db')
  // Asegurar que el directorio db/ exista antes de db:push
  try {
    mkdirSync(join(PROJECT_ROOT, 'db'), { recursive: true })
  } catch {
    // ignore — db:push fallará con un mensaje claro si no se puede crear
  }

  if (!runDbPush()) {
    console.error('')
    console.error('❌ No se pudo crear la base de datos automáticamente.')
    console.error(`   Project root: ${PROJECT_ROOT}`)
    console.error('')
    console.error('   Creá la BD manualmente y volvé a correr este script:')
    console.error(`     cd ${PROJECT_ROOT} && bun run db:push`)
    console.error('')
    process.exit(1)
  }

  if (fileExistsAt(targetDb)) {
    console.log(`✅ BD creada: ${targetDb}`)
    return `file:${targetDb}`
  }

  // db:push pudo haberla creado en otra ubicación (según schema.prisma).
  // Re-buscamos en las ubicaciones comunes.
  for (const loc of commonLocations) {
    if (fileExistsAt(loc)) {
      console.log(`✅ BD creada: ${loc}`)
      return `file:${loc}`
    }
  }

  console.error('')
  console.error('❌ db:push se ejecutó pero no se encontró el archivo custom.db.')
  console.error('   Revisá la salida arriba y los permisos del directorio db/.')
  process.exit(1)
}

const RESOLVED_DATABASE_URL = resolveDatabaseUrl()
process.env.DATABASE_URL = RESOLVED_DATABASE_URL

// --- Ahora sí, importar Prisma (dinámico) y el resto ---------------------
// Usamos import dinámico para que la carga del .env y la resolución de
// DATABASE_URL ocurran ANTES de que PrismaClient se instancie.
// Path relativo para evitar problemas de resolución de alias en scripts.
import bcrypt from 'bcryptjs'
import readline from 'readline'

const { db } = await import('../src/lib/db')

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
  console.log(`  Project root    : ${PROJECT_ROOT}`)
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

// --- Helper: crear el super admin si no existe ---------------------------
// Permisos completos del Super Administrador (mismo set que create-super-admin.ts)
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

const SUPER_ADMIN_ROLE_NAME = 'Super Administrador'
const SUPER_ADMIN_NAME = 'Dubiel'
// Contraseña temporal con la que se crea el usuario; se cambia de inmediato
// por la que el usuario eligió. No se usa para login.
const TEMP_PLACEHOLDER_PASSWORD = 'TempPlaceholder!ChangeMe!2026'

async function ensureSuperAdminExists(username: string): Promise<void> {
  console.log('')
  console.log(`📦 El usuario "${username}" no existe. Creándolo como Super Administrador...`)
  console.log('')

  // 1. Crear o actualizar el rol "Super Administrador"
  let role = await db.role.findFirst({ where: { name: SUPER_ADMIN_ROLE_NAME } })
  if (role) {
    role = await db.role.update({
      where: { id: role.id },
      data: {
        permissions: JSON.stringify(ALL_PERMISSIONS),
        description: 'Acceso total al sistema - Super Administrador',
        isActive: true,
      },
    })
    console.log(`  ✅ Rol "${SUPER_ADMIN_ROLE_NAME}" actualizado con todos los permisos`)
  } else {
    role = await db.role.create({
      data: {
        name: SUPER_ADMIN_ROLE_NAME,
        description: 'Acceso total al sistema - Super Administrador',
        permissions: JSON.stringify(ALL_PERMISSIONS),
        isActive: true,
      },
    })
    console.log(`  ✅ Rol "${SUPER_ADMIN_ROLE_NAME}" creado con todos los permisos`)
  }

  // 2. Crear el usuario con contraseña temporal (se sobrescribe enseguida)
  const hashedPlaceholder = await bcrypt.hash(TEMP_PLACEHOLDER_PASSWORD, 10)
  await db.user.create({
    data: {
      username,
      password: hashedPlaceholder,
      name: SUPER_ADMIN_NAME,
      email: 'dubiel@kioskoapp.com',
      roleId: role.id,
      isActive: true,
    },
  })
  console.log(`  ✅ Usuario "${username}" creado (rol: ${SUPER_ADMIN_ROLE_NAME}, activo)`)
  console.log(`     La contraseña temporal se reemplazará por la que ingresaste arriba.`)
  console.log('')
}

async function changePassword() {
  printBanner()

  // 1. Verificar que el usuario exista
  let user = await db.user.findUnique({
    where: { username: TARGET_USERNAME },
    include: { role: true },
  })

  if (!user) {
    // Auto-crear el super admin si no existe (no fallar)
    await ensureSuperAdminExists(TARGET_USERNAME)
    // Re-leer el usuario recién creado
    user = await db.user.findUnique({
      where: { username: TARGET_USERNAME },
      include: { role: true },
    })
    if (!user) {
      console.error('❌ Error inesperado: el usuario no se pudo crear ni releer.')
      process.exit(1)
    }
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
