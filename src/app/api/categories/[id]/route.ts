import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description } = body

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null

    const updated = await db.category.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Error al actualizar categoría' },
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

    const category = await db.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una categoría que tiene productos' },
        { status: 400 }
      )
    }

    await db.category.delete({ where: { id } })

    return NextResponse.json({ message: 'Categoría eliminada' })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Error al eliminar categoría' },
      { status: 500 }
    )
  }
}
