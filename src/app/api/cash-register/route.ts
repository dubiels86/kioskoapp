import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const history = searchParams.get('history')

    // History mode: return closed registers
    if (history === 'true') {
      const closedRegisters = await db.cashRegister.findMany({
        where: { status: 'CERRADA' },
        orderBy: { closedAt: 'desc' },
        take: 10,
      })
      return NextResponse.json(closedRegisters)
    }

    // Default: return current open register
    const cashRegister = await db.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
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

    return NextResponse.json(cashRegister)
  } catch (error) {
    console.error('Error fetching cash register:', error)
    return NextResponse.json(
      { error: 'Error al obtener caja' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const body = await request.json()

    // Close cash register action
    if (action === 'close') {
      const { cashRegisterId, closingAmount, billBreakdown } = body

      if (!cashRegisterId) {
        return NextResponse.json(
          { error: 'ID de caja requerido' },
          { status: 400 }
        )
      }

      const cashRegister = await db.cashRegister.findUnique({
        where: { id: cashRegisterId },
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
      const difference = closingAmount - expectedAmount

      const closed = await db.cashRegister.update({
        where: { id: cashRegisterId },
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
    }

    // Open new cash register
    const { openingAmount, billBreakdown } = body

    if (openingAmount === undefined || openingAmount === null) {
      return NextResponse.json(
        { error: 'El monto de apertura es requerido' },
        { status: 400 }
      )
    }

    // Check no other register is open
    const openRegister = await db.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
    })

    if (openRegister) {
      return NextResponse.json(
        { error: 'Ya hay una caja abierta. Debe cerrarla antes de abrir una nueva.' },
        { status: 400 }
      )
    }

    const cashRegister = await db.cashRegister.create({
      data: {
        openingAmount: parseFloat(openingAmount),
        status: 'ABIERTA',
        openingBillBreakdown: billBreakdown || null,
      },
      include: {
        sales: true,
        movements: true,
      },
    })

    return NextResponse.json(cashRegister, { status: 201 })
  } catch (error) {
    console.error('Error with cash register:', error)
    return NextResponse.json(
      { error: 'Error con la caja registradora' },
      { status: 500 }
    )
  }
}
