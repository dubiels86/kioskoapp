/**
 * Script para empaquetar una actualización del sistema KioskoApp
 * 
 * Uso: bun run scripts/build-update.ts
 * 
 * Este script:
 * 1. Crea un archivo tar.gz con todos los archivos del proyecto necesarios
 * 2. Excluye node_modules, .next, bases de datos, y archivos temporales
 * 3. Genera el archivo en public/kiosko-app.tar.gz
 * 4. También crea un archivo update.tar.gz más pequeño para actualizaciones incrementales
 * 
 * El archivo resultante se puede usar:
 * - Descarga completa: public/kiosko-app.tar.gz
 * - Actualización incremental: public/update.tar.gz (solo src/ + scripts/ + prisma/)
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const APP_VERSION = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')).version

console.log('')
console.log('📦 KioskoApp - Empaquetando actualización v' + APP_VERSION)
console.log('='.repeat(50))
console.log('')

// Files/directories to exclude from the tarball
const EXCLUDES = [
  'node_modules',
  '.next',
  '.git',
  '.gitignore',
  'db/*.db',
  'db/*.db-*',
  'db/*.journal',
  'prisma/dev.db',
  'prisma/dev.db-journal',
  'prisma/migrations',
  '*.log',
  'dev.log',
  'server.log',
  'watchdog.log',
  'dev-server-keeper.log',
  'server-restarts.log',
  '.env',
  'agent-ctx',
  'worklog.md',
  'update-v2.tar.gz',
  'update-v3.tar.gz',
  'kiosko-app.tar.gz',
  'update.tar.gz',
  'keep-alive.sh',
  'keep-server-alive.sh',
  'watchdog.sh',
  'dev-keeper.sh',
  'start-server.sh',
  'start-dev.sh',
]

console.log('🗂️  Archivos a excluir:')
EXCLUDES.forEach(e => console.log(`   - ${e}`))
console.log('')

// Build full package (for new downloads)
console.log('📦 Creando paquete completo (kiosko-app.tar.gz)...')
try {
  const excludeArgs = EXCLUDES.map(e => `--exclude='${e}'`).join(' ')

  // Create the full package
  execSync(
    `tar -czf public/kiosko-app.tar.gz ${excludeArgs} --transform='s,^,kiosko-app/,' .`,
    { stdio: 'inherit', cwd: process.cwd() }
  )
  console.log('  ✅ public/kiosko-app.tar.gz creado')
} catch (error) {
  console.error('  ❌ Error creando kiosko-app.tar.gz:', error)
  process.exit(1)
}

// Build incremental update package (for existing installations)
console.log('')
console.log('📦 Creando paquete de actualización (update.tar.gz)...')
try {
  const updateFiles = [
    'src/',
    'scripts/',
    'prisma/schema.prisma',
    'prisma/seed.ts',
    'public/update.sh',
    'components.json',
    'next.config.ts',
    'tsconfig.json',
    'postcss.config.mjs',
    'tailwind.config.ts',
  ].filter(f => existsSync(join(process.cwd(), f)))

  // Create a list file for tar
  const listContent = updateFiles.join('\n')
  writeFileSync('/tmp/kiosko-update-files.txt', listContent)

  const excludeArgs = EXCLUDES.map(e => `--exclude='${e}'`).join(' ')

  // For the update, we need to create it from specific directories
  execSync(
    `tar -czf public/update.tar.gz ${excludeArgs} --transform='s,^,kiosko-app/,' src/ scripts/ prisma/ public/update.sh components.json next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts 2>/dev/null || true`,
    { stdio: 'inherit', cwd: process.cwd() }
  )
  console.log('  ✅ public/update.tar.gz creado')
} catch (error) {
  console.error('  ⚠️  Error creando update.tar.gz (no crítico):', error)
}

// Generate a version info file
console.log('')
console.log('📝 Generando info de versión...')
const versionInfo = {
  version: APP_VERSION,
  buildDate: new Date().toISOString(),
  files: {
    fullPackage: 'public/kiosko-app.tar.gz',
    updatePackage: 'public/update.tar.gz',
  },
}
writeFileSync('public/version.json', JSON.stringify(versionInfo, null, 2))
console.log('  ✅ public/version.json creado')

// Get file sizes
console.log('')
console.log('📊 Tamaños de los paquetes:')
try {
  const fullSize = execSync('stat -f%z public/kiosko-app.tar.gz 2>/dev/null || stat -c%s public/kiosko-app.tar.gz 2>/dev/null || echo "0"').toString().trim()
  const updateSize = execSync('stat -f%z public/update.tar.gz 2>/dev/null || stat -c%s public/update.tar.gz 2>/dev/null || echo "0"').toString().trim()

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  console.log(`   📥 Paquete completo: ${formatSize(parseInt(fullSize))}`)
  console.log(`   🔄 Paquete update: ${formatSize(parseInt(updateSize))}`)
} catch {
  console.log('   (No se pudieron obtener los tamaños)')
}

console.log('')
console.log('='.repeat(50))
console.log('✅ Empaquetado completado!')
console.log('')
console.log('📋 Para distribuir la actualización:')
console.log('   1. El usuario descarga kiosko-app.tar.gz (instalación nueva)')
console.log('   2. El usuario descarga update.tar.gz + update.sh (actualización)')
console.log('   3. Ejecuta: chmod +x update.sh && ./update.sh')
console.log('')
console.log(`🏷️  Versión: v${APP_VERSION}`)
console.log('')
