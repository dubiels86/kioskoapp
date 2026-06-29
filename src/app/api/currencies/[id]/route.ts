import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/currencies/[id] - Update currency
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    // Validate that only allowed fields are being updated
    const allowedFields = ['exchangeRate', 'isActive', 'symbol', 'name', 'locale']
    const updates: Record<string, unknown> = {}

    for (const key in data) {
      if (allowedFields.includes(key)) {
        updates[key] = data[key]
      }
    }

    // If trying to update exchange rate, validate it's a positive number
    if (updates.exchangeRate !== undefined && (typeof updates.exchangeRate !== 'number' || updates.exchangeRate <= 0)) {
      return NextResponse.json(
        { error: 'El tipo de cambio debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Update currency
    const updatedCurrency = await db.currency.update({
      where: {
        id,
      },
      data: updates,
    })

    return NextResponse.json(updatedCurrency)
  } catch (error) {
    console.error('Error updating currency:', error)
    
    // Check if currency not found
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Moneda no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Error al actualizar moneda' },
      { status: 500 }
    )
  }
}
