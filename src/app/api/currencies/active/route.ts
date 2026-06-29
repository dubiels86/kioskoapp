import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies/active - Get active currencies
export async function GET(request: NextRequest) {
  try {
    const currencies = await db.currency.findMany({
      where: { isActive: true },
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    })

    return NextResponse.json(currencies)
  } catch (error) {
    console.error('Error fetching active currencies:', error)
    return NextResponse.json(
      { error: 'Error al obtener monedas activas' },
      { status: 500 }
    )
  }
}