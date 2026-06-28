import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'

const BACKUPS_DIR = path.join(process.cwd(), 'db', 'backups')
const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')

// Ensure backups directory exists
async function ensureBackupsDir() {
  try {
    await fs.access(BACKUPS_DIR)
  } catch {
    await fs.mkdir(BACKUPS_DIR, { recursive: true })
  }
}

// Validate backup filename (security: prevent path traversal)
function isValidBackupFilename(name: string): boolean {
  return /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(name)
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

// GET /api/backups - List all backups
export async function GET() {
  try {
    await ensureBackupsDir()
    const files = await fs.readdir(BACKUPS_DIR)
    const backups = []

    for (const file of files) {
      if (!file.endsWith('.db')) continue
      const filePath = path.join(BACKUPS_DIR, file)
      const stat = await fs.stat(filePath)
      // Parse optional description from companion .meta.json file
      let description: string | null = null
      const metaPath = filePath.replace(/\.db$/, '.meta.json')
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
        description = meta.description || null
      } catch {
        // no meta file
      }
      backups.push({
        filename: file,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        description,
      })
    }

    // Sort by date descending (newest first)
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Get auto-backup settings
    let autoBackupEnabled = false
    let autoBackupFrequency = 'daily' // daily, weekly, monthly
    let autoBackupMaxKeep = 7
    try {
      const setting = await db.setting.findUnique({ where: { key: 'auto_backup_enabled' } })
      if (setting) autoBackupEnabled = JSON.parse(setting.value) === true
      const freqSetting = await db.setting.findUnique({ where: { key: 'auto_backup_frequency' } })
      if (freqSetting) autoBackupFrequency = JSON.parse(freqSetting.value)
      const maxKeepSetting = await db.setting.findUnique({ where: { key: 'auto_backup_max_keep' } })
      if (maxKeepSetting) autoBackupMaxKeep = parseInt(JSON.parse(maxKeepSetting.value)) || 7
    } catch {
      // ignore settings errors
    }

    return NextResponse.json({
      backups,
      settings: {
        autoBackupEnabled,
        autoBackupFrequency,
        autoBackupMaxKeep,
      },
    })
  } catch (error) {
    console.error('Error listing backups:', error)
    return NextResponse.json({ error: 'Error al listar respaldos' }, { status: 500 })
  }
}

// POST /api/backups - Create a new backup
export async function POST(request: NextRequest) {
  try {
    await ensureBackupsDir()

    const body = await request.json().catch(() => ({}))
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : null

    // Use VACUUM INTO to create a consistent snapshot of the SQLite database
    const timestamp = formatTimestamp(new Date())
    const filename = `backup-${timestamp}.db`
    const backupPath = path.join(BACKUPS_DIR, filename)

    // Verify source DB exists
    try {
      await fs.access(DB_PATH)
    } catch {
      return NextResponse.json({ error: 'Base de datos no encontrada' }, { status: 500 })
    }

    // Use SQLite VACUUM INTO via Prisma raw query (creates a clean, consistent copy)
    await db.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`)

    // Verify the backup was created
    const stat = await fs.stat(backupPath)

    // Save description in companion meta file
    if (description) {
      const metaPath = backupPath.replace(/\.db$/, '.meta.json')
      await fs.writeFile(metaPath, JSON.stringify({ description, createdAt: new Date().toISOString() }, null, 2))
    }

    return NextResponse.json({
      success: true,
      backup: {
        filename,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        description,
      },
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json({ error: 'Error al crear respaldo' }, { status: 500 })
  }
}

// PUT /api/backups - Update backup settings (auto-backup config)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { autoBackupEnabled, autoBackupFrequency, autoBackupMaxKeep } = body

    const updates: Array<{ key: string; value: string; label: string; group: string }> = []

    if (typeof autoBackupEnabled === 'boolean') {
      updates.push({
        key: 'auto_backup_enabled',
        value: JSON.stringify(autoBackupEnabled),
        label: 'Respaldo Automático Activado',
        group: 'backup',
      })
    }
    if (typeof autoBackupFrequency === 'string' && ['daily', 'weekly', 'monthly'].includes(autoBackupFrequency)) {
      updates.push({
        key: 'auto_backup_frequency',
        value: JSON.stringify(autoBackupFrequency),
        label: 'Frecuencia de Respaldo Automático',
        group: 'backup',
      })
    }
    if (typeof autoBackupMaxKeep === 'number' && autoBackupMaxKeep >= 1 && autoBackupMaxKeep <= 100) {
      updates.push({
        key: 'auto_backup_max_keep',
        value: JSON.stringify(autoBackupMaxKeep),
        label: 'Máximo de Respaldos a Conservar',
        group: 'backup',
      })
    }

    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: u,
      })
    }

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('Error updating backup settings:', error)
    return NextResponse.json({ error: 'Error al guardar configuración de respaldo' }, { status: 500 })
  }
}
