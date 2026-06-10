import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/currencies/[id] - Update a currency
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, symbol, locale, isBase, exchangeRate, isActive } = body

    const existing = await db.currency.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Moneda no encontrada' }, { status: 404 })
    }

    // If setting as base, unset any existing base
    if (isBase && !existing.isBase) {
      await db.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false, exchangeRate: 1 },
      })
    }

    const currency = await db.currency.update({
      where: { id },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(name && { name }),
        ...(symbol && { symbol }),
        ...(locale && { locale }),
        ...(isBase !== undefined && { isBase, exchangeRate: isBase ? 1 : (exchangeRate ?? existing.exchangeRate) }),
        ...(exchangeRate !== undefined && !isBase && { exchangeRate }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    // Record exchange rate change in history
    if (exchangeRate !== undefined && exchangeRate !== existing.exchangeRate && !isBase) {
      const baseCurrency = await db.currency.findFirst({ where: { isBase: true } })
      if (baseCurrency) {
        await db.exchangeRateHistory.create({
          data: {
            fromCurrency: baseCurrency.code,
            toCurrency: currency.code,
            rate: exchangeRate,
            source: 'manual',
          },
        })
      }
    }

    return NextResponse.json(currency)
  } catch (error) {
    console.error('Error updating currency:', error)
    return NextResponse.json({ error: 'Error al actualizar moneda' }, { status: 500 })
  }
}

// DELETE /api/currencies/[id] - Delete a currency
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.currency.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Moneda no encontrada' }, { status: 404 })
    }

    if (existing.isBase) {
      return NextResponse.json({ error: 'No se puede eliminar la moneda principal' }, { status: 400 })
    }

    await db.currency.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting currency:', error)
    return NextResponse.json({ error: 'Error al eliminar moneda' }, { status: 500 })
  }
}
