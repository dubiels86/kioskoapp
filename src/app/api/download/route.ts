import { NextRequest, NextResponse } from 'next/server'
import { stat, createReadStream } from 'fs'
import { join } from 'path'
import { APP_VERSION } from '@/lib/version'
import { Readable } from 'stream'

export async function GET(request: NextRequest) {
  try {
    // ?type=update → download update.tar.gz (small, ~170KB)
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

    // Check file exists and get size
    const fileStat = await new Promise<{ size: number; isFile: boolean } | null>((resolve) => {
      stat(filePath, (err, stats) => {
        if (err || !stats?.isFile()) {
          resolve(null)
        } else {
          resolve({ size: stats.size, isFile: true })
        }
      })
    })

    if (!fileStat) {
      return NextResponse.json(
        { error: 'Archivo no encontrado. Ejecutá "bun run build-update" para generar los paquetes.' },
        { status: 404 }
      )
    }

    // Stream the file to avoid OOM on large files
    const nodeStream = createReadStream(filePath)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-App-Version': APP_VERSION,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Error al descargar' }, { status: 500 })
  }
}
