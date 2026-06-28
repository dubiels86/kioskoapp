import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'

const BACKUPS_DIR = path.join(process.cwd(), 'db', 'backups')
const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')

// Validate backup filename (security: prevent path traversal)
function isValidBackupFilename(name: string): boolean {
  return /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(name)
}

// GET /api/backups/[id]?action=download - Download a backup file
// GET /api/backups/[id]?action=info - Get backup info (tables + row counts)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: filename } = await params
    const action = request.nextUrl.searchParams.get('action') || 'download'

    if (!isValidBackupFilename(filename)) {
      return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
    }

    const filePath = path.join(BACKUPS_DIR, filename)
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ error: 'Respaldo no encontrado' }, { status: 404 })
    }

    if (action === 'info') {
      // Read the companion meta file and the file stats
      const stat = await fs.stat(filePath)
      let description: string | null = null
      try {
        const meta = JSON.parse(await fs.readFile(filePath.replace(/\.db$/, '.meta.json'), 'utf-8'))
        description = meta.description || null
      } catch {
        // no meta
      }
      return NextResponse.json({
        filename,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        description,
      })
    }

    // Default: download the file
    const fileBuffer = await fs.readFile(filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json({ error: 'Error al descargar respaldo' }, { status: 500 })
  }
}

// POST /api/backups/[id] - Restore a backup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: filename } = await params

    if (!isValidBackupFilename(filename)) {
      return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
    }

    const backupPath = path.join(BACKUPS_DIR, filename)
    try {
      await fs.access(backupPath)
    } catch {
      return NextResponse.json({ error: 'Respaldo no encontrado' }, { status: 404 })
    }

    // Safety: create a pre-restore backup of the current DB
    const preRestoreDir = path.join(process.cwd(), 'db', 'backups')
    try {
      await fs.access(preRestoreDir)
    } catch {
      await fs.mkdir(preRestoreDir, { recursive: true })
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    const preRestoreBackup = path.join(preRestoreDir, `backup-${ts}.db`)

    // Backup current DB before restoring (VACUUM INTO works on the live DB)
    try {
      await fs.access(DB_PATH)
      await db.$executeRawUnsafe(`VACUUM INTO '${preRestoreBackup.replace(/'/g, "''")}'`)
    } catch (e) {
      console.error('Pre-restore backup failed:', e)
      // If the live DB doesn't exist, continue anyway (restore to fresh)
    }

    // Disconnect Prisma so it releases the file handle (SQLite keeps file open)
    await db.$disconnect()

    // Copy backup file over the live database
    const backupBuffer = await fs.readFile(backupPath)
    await fs.writeFile(DB_PATH, backupBuffer)

    // Reconnect Prisma
    await db.$connect()

    return NextResponse.json({
      success: true,
      message: 'Respaldo restaurado correctamente. Se recomienda recargar la página.',
      preRestoreBackup: path.basename(preRestoreBackup),
    })
  } catch (error) {
    console.error('Error restoring backup:', error)
    // Try to reconnect Prisma in case of error
    try {
      await db.$connect()
    } catch {
      // ignore
    }
    return NextResponse.json({ error: 'Error al restaurar respaldo' }, { status: 500 })
  }
}

// DELETE /api/backups/[id] - Delete a backup file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: filename } = await params

    if (!isValidBackupFilename(filename)) {
      return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
    }

    const filePath = path.join(BACKUPS_DIR, filename)
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ error: 'Respaldo no encontrado' }, { status: 404 })
    }

    // Delete the backup file
    await fs.unlink(filePath)
    // Delete companion meta file if exists
    try {
      await fs.unlink(filePath.replace(/\.db$/, '.meta.json'))
    } catch {
      // no meta file
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting backup:', error)
    return NextResponse.json({ error: 'Error al eliminar respaldo' }, { status: 500 })
  }
}
