import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cashRegister = await db.cashRegister.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: 'Caja no encontrada' },
        { status: 404 }
      )
    }

    // Group sales by payment method (normalize legacy TRANSFERENCIA → TARJETA)
    const normalizeMethod = (m: string) => m === 'TRANSFERENCIA' ? 'TARJETA' : m
    const salesByMethod = {
      EFECTIVO: { count: 0, total: 0 },
      TARJETA: { count: 0, total: 0 },
      CUENTA_CASA: { count: 0, total: 0, costTotal: 0 },
    }

    for (const sale of cashRegister.sales) {
      const method = normalizeMethod(sale.paymentMethod) as keyof typeof salesByMethod
      if (salesByMethod[method]) {
        const group = salesByMethod[method]
        group.count++
        group.total += sale.total
        if (method === 'CUENTA_CASA') {
          group.costTotal += sale.costTotal
        }
      }
    }

    return NextResponse.json({
      ...cashRegister,
      salesByMethod,
    })
  } catch (error) {
    console.error('Error fetching cash register:', error)
    return NextResponse.json(
      { error: 'Error al obtener caja' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { closingAmount, billBreakdown } = body

    const cashRegister = await db.cashRegister.findUnique({
      where: { id },
      include: {
        sales: true,
        movements: true,
      },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: 'Caja no encontrada' },
        { status: 404 }
      )
    }

    if (cashRegister.status === 'CERRADA') {
      return NextResponse.json(
        { error: 'La caja ya está cerrada' },
        { status: 400 }
      )
    }

    if (closingAmount === undefined || closingAmount === null) {
      return NextResponse.json(
        { error: 'El monto de cierre es requerido' },
        { status: 400 }
      )
    }

    // Calculate expected amount
    const efectivoSales = cashRegister.sales
      .filter((s) => s.paymentMethod === 'EFECTIVO')
      .reduce((sum, s) => sum + s.total, 0)

    const entradaMovements = cashRegister.movements
      .filter((m) => m.type === 'ENTRADA')
      .reduce((sum, m) => sum + m.amount, 0)

    const salidaMovements = cashRegister.movements
      .filter((m) => m.type === 'SALIDA')
      .reduce((sum, m) => sum + m.amount, 0)

    const expectedAmount =
      cashRegister.openingAmount + efectivoSales + entradaMovements - salidaMovements
    const difference = parseFloat(closingAmount) - expectedAmount

    const closed = await db.cashRegister.update({
      where: { id },
      data: {
        status: 'CERRADA',
        closingAmount: parseFloat(closingAmount),
        expectedAmount,
        difference,
        closedAt: new Date(),
        closingBillBreakdown: billBreakdown || null,
      },
      include: {
        sales: true,
        movements: true,
      },
    })

    return NextResponse.json(closed)
  } catch (error) {
    console.error('Error closing cash register:', error)
    return NextResponse.json(
      { error: 'Error al cerrar caja' },
      { status: 500 }
    )
  }
}
