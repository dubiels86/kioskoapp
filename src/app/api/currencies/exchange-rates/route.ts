import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies/exchange-rates - Get exchange rate history
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const from = url.searchParams.get('from') || 'USD'
    const to = url.searchParams.get('to') || 'CUP'
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const exchangeRates = await db.exchangeRateHistory.findMany({
      where: {
        fromCurrency: from,
        toCurrency: to,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(exchangeRates)
  } catch (error) {
    console.error('Error fetching exchange rate history:', error)
    return NextResponse.json(
      { error: 'Error al obtener historial de tipos de cambio' },
      { status: 500 }
    )
  }
}

// POST /api/currencies/exchange-rates - Create new exchange rate record
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    const { fromCurrency, toCurrency, rate, source } = data

    if (!fromCurrency || !toCurrency || !rate) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: fromCurrency, toCurrency, rate' },
        { status: 400 }
      )
    }

    if (typeof rate !== 'number' || rate <= 0) {
      return NextResponse.json(
        { error: 'El tipo de cambio debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Create new exchange rate record
    const newRate = await db.exchangeRateHistory.create({
      data: {
        fromCurrency,
        toCurrency,
        rate,
        source: source || 'manual',
      },
    })

    return NextResponse.json(newRate, { status: 201 })
  } catch (error) {
    console.error('Error creating exchange rate:', error)
    return NextResponse.json(
      { error: 'Error al crear tipo de cambio' },
      { status: 500 }
    )
  }
}