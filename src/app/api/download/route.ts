import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { readFile, stat, unlink } from 'fs/promises'

const execAsync = promisify(exec)

export async function GET() {
  const tmpFile = join(process.cwd(), '.tmp-download.tar.gz')

  try {
    // Generate tar.gz on the fly - exclude heavy/unnecessary files
    // Note: tar may warn "file changed as we read it" which is harmless
    try {
      await execAsync(
        `tar -czf "${tmpFile}" ` +
        `--exclude='node_modules' ` +
        `--exclude='.next' ` +
        `--exclude='.tmp-download.tar.gz' ` +
        `--exclude='public/project.tar.gz' ` +
        `--exclude='dev.log' ` +
        `--exclude='server-restarts.log' ` +
        `--exclude='keep-server-alive.sh' ` +
        `--exclude='start-server.sh' ` +
        `--exclude='.git' ` +
        `--exclude='prisma/dev.db' ` +
        `--exclude='prisma/dev.db-journal' ` +
        `--exclude='skills' ` +
        `--exclude='agent-ctx' ` +
        `--exclude='.zscripts' ` +
        `--exclude='examples' ` +
        `--exclude='download' ` +
        `--exclude='upload' ` +
        `--exclude='watchdog.sh' ` +
        `--exclude='start-dev.sh' ` +
        `--exclude='worklog.md' ` +
        `--exclude='mini-services' ` +
        `-C "${process.cwd()}" .`,
        { maxBuffer: 10 * 1024 * 1024 }
      )
    } catch (tarError: unknown) {
      // tar exits with code 1 for warnings like "file changed as we read it"
      // The file is still created correctly, so just check if it exists
      const errMsg = tarError instanceof Error ? tarError.message : String(tarError)
      if (!errMsg.includes('file changed as we read it')) {
        throw tarError
      }
    }

    const fileStat = await stat(tmpFile)
    const fileBuffer = await readFile(tmpFile)

    // Clean up temp file
    await unlink(tmpFile).catch(() => {})

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="kiosko-app.tar.gz"',
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    // Clean up on error
    await unlink(tmpFile).catch(() => {})
    return NextResponse.json({ error: 'Error al generar descarga' }, { status: 500 })
  }
}
