import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const warehouse = await db.warehouse.findUnique({
      where: { id },
      include: {
        stocks: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
        _count: {
          select: {
            stocks: true,
            movementsFrom: true,
            movementsTo: true,
            purchaseItems: true,
            saleItems: true,
          },
        },
      },
    })

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Depósito no encontrado' },
        { status: 404 }
      )
    }

    // Add stock summary
    const totalStock = warehouse.stocks.reduce((sum, s) => sum + s.stock, 0)
    const totalProducts = warehouse.stocks.length
    const lowStockItems = warehouse.stocks.filter(
      (s) => s.stock <= s.minStock
    )
    const lowStockCount = lowStockItems.length
    const totalValue = warehouse.stocks.reduce(
      (sum, s) => sum + s.stock * s.product.salePrice,
      0
    )

    return NextResponse.json({
      ...warehouse,
      stockSummary: {
        totalStock,
        totalProducts,
        lowStockCount,
        totalValue,
        lowStockItems: lowStockItems.map((s) => ({
          productId: s.productId,
          productName: s.product.name,
          currentStock: s.stock,
          minStock: s.minStock,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching warehouse:', error)
    return NextResponse.json(
      { error: 'Error al obtener depósito' },
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
    const { name, code, type, address, isActive } = body

    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Depósito no encontrado' },
        { status: 404 }
      )
    }

    // Check code uniqueness if being changed
    if (code && code !== existing.code) {
      const codeExists = await db.warehouse.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { error: 'Ya existe un depósito con ese código' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (code !== undefined) updateData.code = code
    if (type !== undefined) updateData.type = type
    if (address !== undefined) updateData.address = address || null
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await db.warehouse.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating warehouse:', error)
    return NextResponse.json(
      { error: 'Error al actualizar depósito' },
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

    const warehouse = await db.warehouse.findUnique({ where: { id } })
    if (!warehouse) {
      return NextResponse.json(
        { error: 'Depósito no encontrado' },
        { status: 404 }
      )
    }

    // Soft delete - deactivate the warehouse
    const deactivated = await db.warehouse.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json(deactivated)
  } catch (error) {
    console.error('Error deactivating warehouse:', error)
    return NextResponse.json(
      { error: 'Error al desactivar depósito' },
      { status: 500 }
    )
  }
}
