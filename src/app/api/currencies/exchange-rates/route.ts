import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies/exchange-rates - Get exchange rate history
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const where: { fromCurrency?: string; toCurrency?: string } = {}
    if (from) where.fromCurrency = from
    if (to) where.toCurrency = to

    const history = await db.exchangeRateHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return NextResponse.json({ error: 'Error al obtener historial de tipos de cambio' }, { status: 500 })
  }
}
