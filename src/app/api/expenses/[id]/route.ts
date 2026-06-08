import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/expenses/[id] - Update expense
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { description, amount, category, paymentMethod, date, recipient, receiptNumber, notes } = body

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }

    // If amount changed and linked to cash register, update the movement
    if (existing.cashRegisterId && existing.paymentMethod === 'EFECTIVO' && amount !== existing.amount) {
      const diff = amount - existing.amount
      const movement = await db.cashMovement.findFirst({
        where: {
          cashRegisterId: existing.cashRegisterId,
          type: 'SALIDA',
          reason: { contains: existing.description },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (movement) {
        await db.cashMovement.update({
          where: { id: movement.id },
          data: { amount: movement.amount + diff },
        })
      }
    }

    const expense = await db.expense.update({
      where: { id },
      data: {
        description,
        amount,
        category,
        paymentMethod,
        date: date ? new Date(date) : undefined,
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

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 })
  }
}

// DELETE /api/expenses/[id] - Delete expense
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    }

    // If linked to cash register and EFECTIVO, remove the SALIDA movement
    if (existing.cashRegisterId && existing.paymentMethod === 'EFECTIVO') {
      const movement = await db.cashMovement.findFirst({
        where: {
          cashRegisterId: existing.cashRegisterId,
          type: 'SALIDA',
          reason: { contains: existing.description },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (movement) {
        await db.cashMovement.delete({ where: { id: movement.id } })
      }
    }

    await db.expense.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Error al eliminar gasto' }, { status: 500 })
  }
}
