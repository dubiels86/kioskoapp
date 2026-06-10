import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { APP_VERSION } from '@/lib/version'

export async function GET(request: NextRequest) {
  try {
    // ?type=update → download update.tar.gz (small, ~150KB)
    // ?type=full (default) → download kiosko-app.tar.gz (big, ~60MB)
    const type = request.nextUrl.searchParams.get('type') || 'full'

    let fileName: string
    let downloadName: string

    if (type === 'update') {
      fileName = 'update.tar.gz'
      downloadName = `kiosko-app-update-v${APP_VERSION}.tar.gz`
    } else {
      fileName = 'kiosko-app.tar.gz'
      downloadName = `kiosko-app-v${APP_VERSION}.tar.gz`
    }

    const filePath = join(process.cwd(), 'public', fileName)
    
    let fileStat
    try {
      fileStat = await stat(filePath)
      if (!fileStat.isFile()) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
      }
    } catch {
      return NextResponse.json({ 
        error: 'Archivo no encontrado. Ejecutá "bun run build-update" para generar los paquetes.' 
      }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-App-Version': APP_VERSION,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Error al descargar' }, { status: 500 })
  }
}
