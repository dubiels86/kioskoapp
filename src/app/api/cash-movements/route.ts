import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cashRegisterId = searchParams.get('cashRegisterId')

    if (!cashRegisterId) {
      return NextResponse.json(
        { error: 'cashRegisterId es requerido' },
        { status: 400 }
      )
    }

    const movements = await db.cashMovement.findMany({
      where: { cashRegisterId },
      orderBy: { createdAt: 'desc' },
      include: {
        cashRegister: true,
      },
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error('Error fetching cash movements:', error)
    return NextResponse.json(
      { error: 'Error al obtener movimientos de caja' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cashRegisterId, type, amount, reason } = body

    if (!cashRegisterId || !type || !amount || !reason) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos (cashRegisterId, type, amount, reason)' },
        { status: 400 }
      )
    }

    if (type !== 'ENTRADA' && type !== 'SALIDA') {
      return NextResponse.json(
        { error: 'El tipo debe ser ENTRADA o SALIDA' },
        { status: 400 }
      )
    }

    // Validate cash register is open
    const cashRegister = await db.cashRegister.findUnique({
      where: { id: cashRegisterId },
    })

    if (!cashRegister) {
      return NextResponse.json(
        { error: 'Caja no encontrada' },
        { status: 404 }
      )
    }

    if (cashRegister.status !== 'ABIERTA') {
      return NextResponse.json(
        { error: 'La caja debe estar abierta para registrar movimientos' },
        { status: 400 }
      )
    }

    const movement = await db.cashMovement.create({
      data: {
        cashRegisterId,
        type,
        amount: parseFloat(amount),
        reason,
      },
      include: {
        cashRegister: true,
      },
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('Error creating cash movement:', error)
    return NextResponse.json(
      { error: 'Error al crear movimiento de caja' },
      { status: 500 }
    )
  }
}
