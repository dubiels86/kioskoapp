import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies - Get all currencies
export async function GET(request: NextRequest) {
  try {
    const currencies = await db.currency.findMany({
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    })

    return NextResponse.json(currencies)
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json(
      { error: 'Error al obtener monedas' },
      { status: 500 }
    )
  }
}

// POST /api/currencies - Create new currency
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    const { code, name, symbol, exchangeRate } = data

    if (!code || !name || !symbol || exchangeRate === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: code, name, symbol, exchangeRate' },
        { status: 400 }
      )
    }

    // Check if currency with same code already exists
    const existingCurrency = await db.currency.findUnique({
      where: { code },
    })

    if (existingCurrency) {
      return NextResponse.json(
        { error: `Ya existe una moneda con código ${code}` },
        { status: 400 }
      )
    }

    // Create new currency
    const newCurrency = await db.currency.create({
      data: {
        code,
        name,
        symbol,
        exchangeRate: parseFloat(exchangeRate),
        locale: data.locale || 'es-AR',
        isBase: data.isBase || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    })

    return NextResponse.json(newCurrency, { status: 201 })
  } catch (error) {
    console.error('Error creating currency:', error)
    return NextResponse.json(
      { error: 'Error al crear moneda' },
      { status: 500 }
    )
  }
}