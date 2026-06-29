import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'

const BACKUPS_DIR = path.join(process.cwd(), 'db', 'backups')

function isValidBackupFilename(name: string): boolean {
  return /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(name)
}

// POST /api/backups/cleanup - Remove old backups beyond the configured max-keep limit
export async function POST() {
  try {
    let maxKeep = 7
    try {
      const setting = await db.setting.findUnique({ where: { key: 'auto_backup_max_keep' } })
      if (setting) maxKeep = parseInt(JSON.parse(setting.value)) || 7
    } catch {
      // ignore
    }

    try {
      await fs.access(BACKUPS_DIR)
    } catch {
      return NextResponse.json({ success: true, deleted: 0, message: 'No hay respaldos para limpiar' })
    }

    const files = await fs.readdir(BACKUPS_DIR)
    const backupFiles = files.filter((f) => isValidBackupFilename(f))

    // Get stats and sort by mtime descending (newest first)
    const backupsWithStats = []
    for (const file of backupFiles) {
      const filePath = path.join(BACKUPS_DIR, file)
      const stat = await fs.stat(filePath)
      backupsWithStats.push({ file, filePath, mtime: stat.mtime.getTime() })
    }
    backupsWithStats.sort((a, b) => b.mtime - a.mtime)

    // Keep the newest `maxKeep`, delete the rest
    const toDelete = backupsWithStats.slice(maxKeep)
    let deleted = 0
    for (const b of toDelete) {
      try {
        await fs.unlink(b.filePath)
        // Also delete companion meta file
        try {
          await fs.unlink(b.filePath.replace(/\.db$/, '.meta.json'))
        } catch {
          // no meta
        }
        deleted++
      } catch (e) {
        console.error('Failed to delete old backup', b.file, e)
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      remaining: backupsWithStats.length - deleted,
      maxKeep,
    })
  } catch (error) {
    console.error('Error cleaning up backups:', error)
    return NextResponse.json({ error: 'Error al limpiar respaldos antiguos' }, { status: 500 })
  }
}
