import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { APP_VERSION, CHANGELOG } from '@/lib/version'

/**
 * GET /api/update
 * Returns current system version and available update information
 */
export async function GET() {
  try {
    // Get current version from database
    let currentDbVersion = '0.0.0'
    try {
      const versionSetting = await db.setting.findUnique({ where: { key: 'app_version' } })
      if (versionSetting) {
        currentDbVersion = JSON.parse(versionSetting.value)
      }
    } catch {
      // If setting doesn't exist, version is unknown
    }

    // Get last update timestamp
    let lastUpdated: string | null = null
    try {
      const lastUpdatedSetting = await db.setting.findUnique({ where: { key: 'last_updated' } })
      if (lastUpdatedSetting) {
        lastUpdated = JSON.parse(lastUpdatedSetting.value)
      }
    } catch {
      // ignore
    }

    const needsUpdate = currentDbVersion !== APP_VERSION
    const isNewer = currentDbVersion && currentDbVersion > APP_VERSION

    return NextResponse.json({
      currentVersion: currentDbVersion,
      latestVersion: APP_VERSION,
      needsUpdate,
      isNewer,
      lastUpdated,
      changelog: CHANGELOG,
      updateInstructions: needsUpdate && !isNewer
        ? {
            steps: [
              '1. Descargar el paquete de actualización (update.tar.gz + update.sh)',
              '2. Colocar ambos archivos en la raíz del proyecto',
              '3. Ejecutar: chmod +x update.sh && ./update.sh',
              '4. O ejecutar: bun run update-system',
            ],
            command: 'bun run update-system',
            shellScript: 'chmod +x update.sh && ./update.sh',
          }
        : null,
    })
  } catch (error) {
    console.error('Update check error:', error)
    return NextResponse.json(
      { error: 'Error al verificar actualizaciones', latestVersion: APP_VERSION },
      { status: 500 }
    )
  }
}

/**
 * POST /api/update
 * Executes the system update from within the application
 */
export async function POST() {
  try {
    // Update version in database
    await db.setting.upsert({
      where: { key: 'app_version' },
      update: { value: `"${APP_VERSION}"` },
      create: { key: 'app_version', value: `"${APP_VERSION}"`, label: 'Versión del Sistema', group: 'system' },
    })

    await db.setting.upsert({
      where: { key: 'last_updated' },
      update: { value: `"${new Date().toISOString()}"` },
      create: { key: 'last_updated', value: `"${new Date().toISOString()}"`, label: 'Última Actualización', group: 'system' },
    })

    return NextResponse.json({
      success: true,
      message: `Sistema actualizado a v${APP_VERSION}`,
      version: APP_VERSION,
    })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el sistema' },
      { status: 500 }
    )
  }
}
