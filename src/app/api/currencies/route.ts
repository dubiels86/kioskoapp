import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies - List all currencies
export async function GET() {
  try {
    const currencies = await db.currency.findMany({
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    })
    return NextResponse.json(currencies)
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json({ error: 'Error al obtener monedas' }, { status: 500 })
  }
}

// POST /api/currencies - Create a new currency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, symbol, locale, isBase, exchangeRate } = body

    if (!code || !name || !symbol) {
      return NextResponse.json({ error: 'Código, nombre y símbolo son requeridos' }, { status: 400 })
    }

    // If setting as base, unset any existing base
    if (isBase) {
      await db.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false, exchangeRate: 1 },
      })
    }

    const currency = await db.currency.create({
      data: {
        code: code.toUpperCase(),
        name,
        symbol,
        locale: locale || 'es-AR',
        isBase: isBase || false,
        exchangeRate: isBase ? 1 : (exchangeRate || 1),
      },
    })

    // If not base and has exchange rate, record in history
    if (!isBase && exchangeRate && exchangeRate !== 1) {
      const baseCurrency = await db.currency.findFirst({ where: { isBase: true } })
      if (baseCurrency) {
        await db.exchangeRateHistory.create({
          data: {
            fromCurrency: baseCurrency.code,
            toCurrency: code.toUpperCase(),
            rate: exchangeRate,
            source: 'manual',
          },
        })
      }
    }

    return NextResponse.json(currency, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating currency:', error)
    const msg = error instanceof Error && error.message.includes('Unique') 
      ? 'Ya existe una moneda con ese código' 
      : 'Error al crear moneda'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
