import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, phone, email, address } = body

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email || null
    if (address !== undefined) updateData.address = address || null

    const updated = await db.supplier.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Error al actualizar proveedor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchases: true } },
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      )
    }

    if (supplier._count.purchases > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un proveedor que tiene compras' },
        { status: 400 }
      )
    }

    await db.supplier.delete({ where: { id } })

    return NextResponse.json({ message: 'Proveedor eliminado' })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Error al eliminar proveedor' },
      { status: 500 }
    )
  }
}
