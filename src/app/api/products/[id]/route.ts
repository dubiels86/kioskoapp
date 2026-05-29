import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        stocks: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
              },
            },
          },
          orderBy: { warehouse: { name: 'asc' } },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Error al obtener producto' },
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
    const {
      name,
      barcode,
      sku,
      categoryId,
      costPrice,
      salePrice,
      stock,
      minStock,
      unit,
      isActive,
      image,
    } = body

    const existingProduct = await db.product.findUnique({ where: { id } })
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Check barcode uniqueness if being changed
    if (barcode && barcode !== existingProduct.barcode) {
      const barcodeExists = await db.product.findUnique({ where: { barcode } })
      if (barcodeExists) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese código de barras' },
          { status: 400 }
        )
      }
    }

    // Check SKU uniqueness if being changed
    if (sku && sku !== existingProduct.sku) {
      const skuExists = await db.product.findUnique({ where: { sku } })
      if (skuExists) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese SKU' },
          { status: 400 }
        )
      }
    }

    const result = await db.$transaction(async (tx) => {
      // If stock is changing, create an inventory movement
      if (stock !== undefined && stock !== existingProduct.stock) {
        const previousStock = existingProduct.stock
        const newStock = stock
        const difference = newStock - previousStock

        await tx.inventoryMovement.create({
          data: {
            productId: id,
            type: 'AJUSTE',
            quantity: Math.abs(difference),
            previousStock,
            newStock,
            reason: 'Ajuste manual de inventario',
          },
        })
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (barcode !== undefined) updateData.barcode = barcode || null
      if (sku !== undefined) updateData.sku = sku || null
      if (categoryId !== undefined) updateData.categoryId = categoryId || null
      if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice)
      if (salePrice !== undefined) updateData.salePrice = parseFloat(salePrice)
      if (stock !== undefined) updateData.stock = stock
      if (minStock !== undefined) updateData.minStock = minStock
      if (unit !== undefined) updateData.unit = unit
      if (isActive !== undefined) updateData.isActive = isActive
      if (image !== undefined) updateData.image = image || null

      const updated = await tx.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          stocks: {
            include: {
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  type: true,
                },
              },
            },
            orderBy: { warehouse: { name: 'asc' } },
          },
        },
      })

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
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

    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Soft delete
    const deleted = await db.product.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json(deleted)
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    )
  }
}
