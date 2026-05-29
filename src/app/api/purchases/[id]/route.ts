import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(purchase)
  } catch (error) {
    console.error('Error fetching purchase:', error)
    return NextResponse.json(
      { error: 'Error al obtener compra' },
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
    const { status } = body

    const existing = await db.purchase.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status

    const updated = await db.purchase.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating purchase:', error)
    return NextResponse.json(
      { error: 'Error al actualizar compra' },
      { status: 500 }
    )
  }
}
