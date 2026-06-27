import { NextResponse } from 'next/server'
import { stat, createReadStream } from 'fs'
import { join } from 'path'
import { APP_VERSION } from '@/lib/version'
import { Readable } from 'stream'

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'update.sh')

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
      return NextResponse.json({ error: 'update.sh no encontrado' }, { status: 404 })
    }

    // Stream the file
    const nodeStream = createReadStream(filePath)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/x-shellscript',
        'Content-Disposition': `attachment; filename="update-v${APP_VERSION}.sh"`,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-App-Version': APP_VERSION,
      },
    })
  } catch (error) {
    console.error('Download update.sh error:', error)
    return NextResponse.json({ error: 'Error al descargar' }, { status: 500 })
  }
}
