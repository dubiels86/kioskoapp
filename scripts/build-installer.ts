/**
 * build-installer.ts — Empaqueta KioskoApp en un instalador distribuible
 *
 * Genera kioskoapp-installer.tar.gz con:
 *   - app/ → Next.js standalone limpio (server.js + .next + public + node_modules mínimo)
 *   - license-server → binario nativo compilado con Bun (NO expone código fuente)
 *   - prisma/schema.prisma → schema para inicializar la DB en el destino
 *   - scripts/ → instaladores macOS + Linux + runtime script
 *   - README-INSTALACION.txt → instrucciones rápidas
 *   - install.sh → wrapper que detecta el SO y llama al instalador correcto
 *
 * Uso: bun run scripts/build-installer.ts
 *
 * Requisitos previos:
 *   - Haber corrido `bun run build` (genera .next/standalone/)
 *   - Tener bun instalado (para compilar el license-server)
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')
const APP_DIST = join(DIST, 'app')
const SCRIPTS_DIST = join(DIST, 'scripts')
const PRISMA_DIST = join(DIST, 'prisma')
const STANDALONE = join(ROOT, '.next', 'standalone')
const PUBLIC_DIR = join(ROOT, 'public')
const STATIC_DIR = join(ROOT, '.next', 'static')

const APP_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version

console.log('')
console.log('📦 KioskoApp — Generando instalador v' + APP_VERSION)
console.log('='.repeat(60))
console.log('')

// ---------------------------------------------------------------------------
// 0. Limpiar dist/ previo
// ---------------------------------------------------------------------------
console.log('🧹 Limpiando dist/ previo...')
rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })
mkdirSync(APP_DIST, { recursive: true })
mkdirSync(SCRIPTS_DIST, { recursive: true })
mkdirSync(PRISMA_DIST, { recursive: true })

// ---------------------------------------------------------------------------
// 1. Verificar que el standalone build existe
// ---------------------------------------------------------------------------
console.log('')
console.log('🔍 Verificando build standalone...')
if (!existsSync(join(STANDALONE, 'server.js'))) {
  console.error('❌ No se encontró .next/standalone/server.js')
  console.error('   Ejecutá primero: bun run build')
  process.exit(1)
}
console.log('   ✅ Standalone build OK')

// ---------------------------------------------------------------------------
// 2. Copiar SOLO lo necesario al dist/app/ (sin código fuente)
// ---------------------------------------------------------------------------
console.log('')
console.log('📦 Copiando app standalone (sin código fuente)...')

// server.js — el servidor Node autocontenido
cpSync(join(STANDALONE, 'server.js'), join(APP_DIST, 'server.js'))

// .next/ — el build compilado (server-side + static)
// El standalone ya trae .next/server/ y .next/BUILD_ID pero necesitamos agregar static/
console.log('   - Copiando .next/ (build compilado)...')
cpSync(join(STANDALONE, '.next'), join(APP_DIST, '.next'), { recursive: true })

// Copiar static/ al destino correcto (Next.js standalone no lo incluye)
if (existsSync(STATIC_DIR)) {
  console.log('   - Copiando .next/static/ (assets del cliente)...')
  mkdirSync(join(APP_DIST, '.next', 'static'), { recursive: true })
  cpSync(STATIC_DIR, join(APP_DIST, '.next', 'static'), { recursive: true })
}

// public/ — assets estáticos (imágenes, etc.)
if (existsSync(PUBLIC_DIR)) {
  console.log('   - Copiando public/ (assets estáticos)...')
  cpSync(PUBLIC_DIR, join(APP_DIST, 'public'), { recursive: true })
  // Limpiar archivos grandes innecesarios del public
  ;['kiosko-app.tar.gz', 'update.tar.gz', 'project.tar.gz', 'kiosko-src-snapshot.tar.gz']
    .forEach((f) => {
      const p = join(APP_DIST, 'public', f)
      if (existsSync(p)) rmSync(p, { force: true })
    })
}

// node_modules/ — solo los necesarios (trazados por Next.js)
console.log('   - Copiando node_modules/ (solo dependencias necesarias)...')
cpSync(join(STANDALONE, 'node_modules'), join(APP_DIST, 'node_modules'), { recursive: true })

// package.json — para que prisma client funcione
cpSync(join(STANDALONE, 'package.json'), join(APP_DIST, 'package.json'))

// prisma/schema.prisma — el app la necesita para el cliente Prisma
mkdirSync(join(APP_DIST, 'prisma'), { recursive: true })
cpSync(join(ROOT, 'prisma', 'schema.prisma'), join(APP_DIST, 'prisma', 'schema.prisma'))

// src/lib/license-public-key.pem — la clave pública Ed25519 embebida
// (el middleware/proxy la necesita para verificar licencias)
const PUB_KEY_SRC = join(ROOT, 'src', 'lib', 'license-public-key.pem')
if (existsSync(PUB_KEY_SRC)) {
  mkdirSync(join(APP_DIST, 'src', 'lib'), { recursive: true })
  cpSync(PUB_KEY_SRC, join(APP_DIST, 'src', 'lib', 'license-public-key.pem'))
  console.log('   - Clave pública Ed25519 embebida ✓')
}

// .env — variables mínimas para producción
writeFileSync(
  join(APP_DIST, '.env'),
  `DATABASE_URL="file:../data/custom.db"\nNODE_ENV=production\nPORT=3000\nLICENSE_SERVER_URL=http://localhost:3042\n`,
)

// Verificar que NO haya código fuente TS/TSX en el dist
const tsFiles = execSync(`find ${APP_DIST} -name "*.ts" -o -name "*.tsx" 2>/dev/null || true`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean)
if (tsFiles.length > 0) {
  console.warn(`   ⚠️  Encontrados ${tsFiles.length} archivos TS/TSX en el dist (limpiando...):`)
  tsFiles.forEach((f) => {
    if (!f.includes('license-public-key.pem')) {
      rmSync(f, { force: true })
    }
  })
}
console.log('   ✅ Sin código fuente TS/TSX expuesto')

// ---------------------------------------------------------------------------
// 3. Compilar el license-server a binario nativo con Bun
// ---------------------------------------------------------------------------
console.log('')
console.log('🔨 Compilando license-server a binario nativo...')

const LICENSE_SERVER_DIR = join(ROOT, 'mini-services', 'license-server')
const LICENSE_BINARY_DIST = join(DIST, 'license-server')

try {
  execSync(
    `bun build --compile ${join(LICENSE_SERVER_DIR, 'index.ts')} --outfile ${LICENSE_BINARY_DIST} --target=bun`,
    { stdio: 'inherit', cwd: LICENSE_SERVER_DIR },
  )
  console.log('   ✅ Binario license-server compilado')

  // Verificar que el binario existe
  if (!existsSync(LICENSE_BINARY_DIST)) {
    throw new Error('El binario no se generó')
  }
} catch (error) {
  console.error('❌ Error compilando license-server:', error)
  process.exit(1)
}

// Copiar el README del license-server (documentación, no código)
if (existsSync(join(LICENSE_SERVER_DIR, 'README.md'))) {
  cpSync(join(LICENSE_SERVER_DIR, 'README.md'), join(DIST, 'license-server-README.md'))
}

// ---------------------------------------------------------------------------
// 4. Copiar schema.prisma al root del dist (para que el instalador lo use)
// ---------------------------------------------------------------------------
console.log('')
console.log('📋 Copiando prisma/schema.prisma...')
cpSync(join(ROOT, 'prisma', 'schema.prisma'), join(PRISMA_DIST, 'schema.prisma'))
console.log('   ✅ Schema copiado')

// ---------------------------------------------------------------------------
// 5. Copiar scripts de instalación
// ---------------------------------------------------------------------------
console.log('')
console.log('📜 Copiando scripts de instalación...')

const SCRIPTS = [
  'scripts/kiosko-runtime.sh',
  'scripts/install-macos.sh',
  'scripts/uninstall-macos.sh',
  'scripts/install-linux.sh',
  'scripts/uninstall-linux.sh',
]

for (const s of SCRIPTS) {
  const src = join(ROOT, s)
  const dst = join(SCRIPTS_DIST, s.replace('scripts/', ''))
  if (existsSync(src)) {
    cpSync(src, dst)
    execSync(`chmod +x ${dst}`)
    console.log(`   ✅ ${s.split('/').pop()}`)
  } else {
    console.warn(`   ⚠️  No encontrado: ${s}`)
  }
}

// ---------------------------------------------------------------------------
// 6. Crear install.sh wrapper (detecta SO y llama al instalador correcto)
// ---------------------------------------------------------------------------
console.log('')
console.log('🎯 Creando install.sh wrapper...')

writeFileSync(
  join(DIST, 'install.sh'),
  `#!/usr/bin/env bash
# install.sh — wrapper que detecta el SO y llama al instalador correcto
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

case "$(uname -s)" in
  Darwin)
    echo "🍎 Detectado macOS — ejecutando install-macos.sh..."
    exec bash "$DIR/scripts/install-macos.sh" "$@"
    ;;
  Linux)
    echo "🐧 Detectado Linux — ejecutando install-linux.sh..."
    exec bash "$DIR/scripts/install-linux.sh" "$@"
    ;;
  *)
    echo "❌ Sistema operativo no soportado: $(uname -s)"
    echo "   Solo macOS y Linux son soportados."
    exit 1
    ;;
esac
`,
)
execSync(`chmod +x ${join(DIST, 'install.sh')}`)
console.log('   ✅ install.sh creado')

// ---------------------------------------------------------------------------
// 7. Crear README-INSTALACION.txt
// ---------------------------------------------------------------------------
console.log('')
console.log('📖 Creando README-INSTALACION.txt...')

writeFileSync(
  join(DIST, 'README-INSTALACION.txt'),
  `KioskoApp v${APP_VERSION} — Instalador
${'='.repeat(60)}

CONTENIDO DEL PAQUETE
---------------------
  app/                          Build standalone de Next.js (compilado, sin fuente)
    server.js                   Servidor Node autocontenido
    .next/                      Build compilado (JS minificado)
    public/                     Assets estáticos
    node_modules/               Solo dependencias necesarias
    prisma/schema.prisma        Esquema de DB
    src/lib/license-public-key.pem  Clave pública Ed25519
  license-server                Binario nativo (Bun-compiled, sin fuente)
  prisma/schema.prisma          Esquema para inicializar DB
  scripts/
    install-macos.sh            Instalador macOS (launchd autostart)
    uninstall-macos.sh          Desinstalador macOS
    install-linux.sh            Instalador Linux (systemd autostart)
    uninstall-linux.sh          Desinstalador Linux
    kiosko-runtime.sh           Script de arranque (uso interno)
  install.sh                    Wrapper que detecta el SO
  README-INSTALACION.txt        Este archivo


REQUISITOS PREVIOS
------------------
  macOS:
    - macOS 11+ (Big Sur o superior)
    - Node.js 20+ (instalar con: brew install node)
    - Bun 1.0+ (instalar con: curl -fsSL https://bun.sh/install | bash)
    - openssl (incluido en macOS por defecto)
    - Permisos de administrador (sudo)

  Linux:
    - Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / Fedora 35+
    - Node.js 20+ (instalar con: sudo apt install nodejs  o  nvm install 20)
    - Bun 1.0+ (instalar con: curl -fsSL https://bun.sh/install | bash)
    - openssl (sudo apt install openssl)
    - systemd (incluido en la mayoría de distros modernas)
    - Permisos de root (sudo)


INSTALACIÓN
-----------
  1. Copiá este tarball a la PC/servidor destino.
  2. Descomprimí:
       tar -xzf kioskoapp-installer-v${APP_VERSION}.tar.gz
  3. Entrá a la carpeta:
       cd kioskoapp-installer
  4. Ejecutá el instalador:
       sudo ./install.sh
     (en macOS podés omitir sudo si querés instalar en ~/Applications)

  El instalador va a:
    - Copiar todo a /Applications/KioskoApp (macOS) o /opt/kioskoapp (Linux)
    - Generar el par de claves Ed25519 (privada + pública)
    - Inicializar la base de datos SQLite
    - Crear el super-admin (dubiel / admin)
    - Configurar el autostart (launchd/systemd)
    - Iniciar los servicios

  Al finalizar, abrí en el navegador:
    http://localhost:3000


PRIMER USO
---------
  1. La app va a mostrar la pantalla de Activación de Licencia.
  2. Iniciá sesión como super-admin para emitir una licencia:
       Usuario: dubiel
       Password: admin
     (CAMBIÁ LA PASSWORD INMEDIATAMENTE en Ajustes > Usuarios)
  3. Andá a Ajustes > Licencias > "Emitir nueva licencia"
  4. Completá: cliente, plan, vencimiento, dispositivos máx.
  5. Click "Emitir licencia" → copiá el JSON
  6. Cerrá sesión, volvé a la pantalla de activación, pegá el JSON y activá.


GESTIÓN DEL SERVICIO
--------------------
  macOS:
    Ver estado:    sudo launchctl list | grep kiosko
    Detener:       sudo launchctl unload /Library/LaunchDaemons/com.kioskoapp.plist
    Iniciar:       sudo launchctl load -w /Library/LaunchDaemons/com.kioskoapp.plist
    Ver logs:      tail -f /Applications/KioskoApp/logs/app.log
    Desinstalar:   sudo ./scripts/uninstall-macos.sh

  Linux:
    Ver estado:    sudo systemctl status kioskoapp
    Detener:       sudo systemctl stop kioskoapp
    Iniciar:       sudo systemctl start kioskoapp
    Reiniciar:     sudo systemctl restart kioskoapp
    Ver logs:      sudo journalctl -u kioskoapp -f
    Desinstalar:   sudo ./scripts/uninstall-linux.sh


SEGURIDAD
---------
  - La clave privada Ed25519 está en:
      macOS:  /Applications/KioskoApp/keys/private.pem
      Linux:  /opt/kioskoapp/keys/private.pem
    NUNCA la compartas. Si se pierde, todas las licencias emitidas
    quedan inválidas.

  - El ADMIN_API_KEY del license-server está en kiosko.env.
    Usalo solo para llamadas admin (emitir/revocar licencias).

  - Cambiá la password del super-admin dubiel cuanto antes.


RESPALDOS
---------
  La base de datos está en:
    macOS:  /Applications/KioskoApp/data/custom.db
    Linux:  /opt/kioskoapp/data/custom.db

  Hacé backups periódicos. El desinstalador ofrece respaldar antes de borrar.


¿Problemas?
-----------
  Revisá los logs:
    macOS:  /Applications/KioskoApp/logs/
    Linux:  /var/log/kioskoapp/

  Verificá que los puertos 3000 y 3042 estén libres:
    lsof -i :3000 -i :3042    (macOS/Linux)
`,
)
console.log('   ✅ README-INSTALACION.txt creado')

// ---------------------------------------------------------------------------
// 8. Empaquetar todo en kioskoapp-installer.tar.gz
// ---------------------------------------------------------------------------
console.log('')
console.log('🗜️  Empaquetando kioskoapp-installer.tar.gz...')

const TAR_NAME = `kioskoapp-installer-v${APP_VERSION}.tar.gz`
const TAR_PATH = join(ROOT, 'public', TAR_NAME)

// Asegurar que public/ existe
mkdirSync(join(ROOT, 'public'), { recursive: true })

// Crear el tar.gz con prefijo kioskoapp-installer/
execSync(
  `tar -czf ${TAR_PATH} -C ${DIST} --transform='s,^,kioskoapp-installer/,' .`,
  { stdio: 'inherit' },
)

// También crear un symlink kioskoapp-installer.tar.gz (sin versión) para descarga simple
const TAR_LATEST = join(ROOT, 'public', 'kioskoapp-installer.tar.gz')
if (existsSync(TAR_LATEST)) rmSync(TAR_LATEST, { force: true })
execSync(`ln -s ${TAR_NAME} ${TAR_LATEST}`)

// ---------------------------------------------------------------------------
// 9. Reportar tamaños
// ---------------------------------------------------------------------------
console.log('')
console.log('📊 Tamaños:')

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const sizes: Record<string, string> = {
  'app/ (Next.js standalone)': execSync(`du -sh ${APP_DIST}`).toString().split('\t')[0].trim(),
  'license-server (binario)': execSync(`du -sh ${LICENSE_BINARY_DIST}`).toString().split('\t')[0].trim(),
  'scripts/': execSync(`du -sh ${SCRIPTS_DIST}`).toString().split('\t')[0].trim(),
  'kioskoapp-installer.tar.gz': execSync(`du -sh ${TAR_PATH}`).toString().split('\t')[0].trim(),
}

Object.entries(sizes).forEach(([k, v]) => {
  console.log(`   ${k}: ${v}`)
})

// Contar archivos TS/TSX en el tarball (debería ser 0 o solo la clave pública)
const tsInTar = execSync(`tar -tzf ${TAR_PATH} | grep -E '\\.(ts|tsx)$' || true`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean)
console.log('')
console.log(`🔍 Archivos TS/TSX en el tarball: ${tsInTar.length}`)
if (tsInTar.length > 0) {
  console.log('   (deberían ser solo archivos .pem renombrados o ninguno)')
  tsInTar.slice(0, 5).forEach((f) => console.log(`   - ${f}`))
}

// ---------------------------------------------------------------------------
// 10. Limpieza
// ---------------------------------------------------------------------------
console.log('')
console.log('🧹 Limpiando directorio temporal dist/...')
rmSync(DIST, { recursive: true, force: true })

// ---------------------------------------------------------------------------
// Resumen final
// ---------------------------------------------------------------------------
console.log('')
console.log('='.repeat(60))
console.log('✅ Instalador generado!')
console.log('='.repeat(60))
console.log('')
console.log(`📦 Archivo: public/${TAR_NAME}`)
console.log(`   Tamaño: ${sizes['kioskoapp-installer.tar.gz']}`)
console.log(`   Versión: v${APP_VERSION}`)
console.log('')
console.log('📋 Para distribuir:')
console.log('   1. Descargá public/' + TAR_NAME + ' desde el Panel de Vista Previa')
console.log('   2. Copialo a la PC/servidor destino')
console.log('   3. Descomprimí: tar -xzf ' + TAR_NAME)
console.log('   4. Ejecutá: sudo ./install.sh')
console.log('')
