import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies/exchange-rates/current - Get current exchange rate
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const from = url.searchParams.get('from') || 'USD'
    const to = url.searchParams.get('to') || 'CUP'

    // Get latest exchange rate from history
    const latestRate = await db.exchangeRateHistory.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
      },
      orderBy: { createdAt: 'desc' },
    })

    // If no history, get from currency table
    if (!latestRate) {
      const fromCurrency = await db.currency.findFirst({
        where: { code: from },
      })

      const toCurrency = await db.currency.findFirst({
        where: { code: to },
      })

      if (!fromCurrency || !toCurrency) {
        return NextResponse.json(
          { error: 'Moneda no encontrada' },
          { status: 404 }
        )
      }

      // Calculate exchange rate from currency table
      const rate = toCurrency.isBase ? fromCurrency.exchangeRate : 1 / toCurrency.exchangeRate

      return NextResponse.json({
        fromCurrency: from,
        toCurrency: to,
        rate,
        source: 'currency-table',
        createdAt: new Date(),
      })
    }

    return NextResponse.json(latestRate)
  } catch (error) {
    console.error('Error fetching current exchange rate:', error)
    return NextResponse.json(
      { error: 'Error al obtener tipo de cambio actual' },
      { status: 500 }
    )
  }
}