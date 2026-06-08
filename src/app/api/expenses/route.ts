import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/expenses - List expenses with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (category && category !== 'all') {
      where.category = category
    }

    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, unknown>).gte = new Date(from)
      if (to) (where.date as Record<string, unknown>).lte = new Date(to + 'T23:59:59')
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { recipient: { contains: search } },
        { receiptNumber: { contains: search } },
        { notes: { contains: search } },
      ]
    }

    const expenses = await db.expense.findMany({
      where,
      include: {
        cashRegister: {
          select: { id: true, status: true, openedAt: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    // Calculate totals
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
    const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount
      return acc
    }, {})
    const byPaymentMethod = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.paymentMethod] = (acc[e.paymentMethod] || 0) + e.amount
      return acc
    }, {})

    return NextResponse.json({
      expenses,
      summary: { totalAmount, count: expenses.length, byCategory, byPaymentMethod },
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 })
  }
}

// POST /api/expenses - Create new expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, amount, category, paymentMethod, date, cashRegisterId, recipient, receiptNumber, notes } = body

    if (!description || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Descripción y monto son requeridos' }, { status: 400 })
    }

    // If there's an open cash register and payment is EFECTIVO, link it
    let registerId = cashRegisterId
    if (!registerId && paymentMethod === 'EFECTIVO') {
      const openRegister = await db.cashRegister.findFirst({
        where: { status: 'ABIERTA' },
      })
      if (openRegister) {
        registerId = openRegister.id
      }
    }

    // If linked to cash register, create a SALIDA movement
    if (registerId && paymentMethod === 'EFECTIVO') {
      await db.cashMovement.create({
        data: {
          cashRegisterId: registerId,
          type: 'SALIDA',
          amount,
          reason: `Gasto: ${description}${recipient ? ` - ${recipient}` : ''}`,
        },
      })
    }

    const expense = await db.expense.create({
      data: {
        description,
        amount,
        category: category || 'OTRO',
        paymentMethod: paymentMethod || 'EFECTIVO',
        date: date ? new Date(date) : new Date(),
        cashRegisterId: registerId,
        recipient,
        receiptNumber,
        notes,
      },
      include: {
        cashRegister: {
          select: { id: true, status: true, openedAt: true },
        },
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Error al crear gasto' }, { status: 500 })
  }
}
