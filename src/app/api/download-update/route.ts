import { NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { APP_VERSION } from '@/lib/version'

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'update.sh')
    
    try {
      const fileStat = await stat(filePath)
      if (!fileStat.isFile()) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
      }
    } catch {
      return NextResponse.json({ error: 'update.sh no encontrado' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/x-shellscript',
        'Content-Disposition': `attachment; filename="update-v${APP_VERSION}.sh"`,
        'Cache-Control': 'public, max-age=3600',
        'X-App-Version': APP_VERSION,
      },
    })
  } catch (error) {
    console.error('Download update.sh error:', error)
    return NextResponse.json({ error: 'Error al descargar' }, { status: 500 })
  }
}
