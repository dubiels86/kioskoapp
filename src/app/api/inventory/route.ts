import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productId, warehouseId, quantity, reason } = body

    // Validate required fields
    if (!productId || !warehouseId || !quantity) {
      return NextResponse.json(
        { error: 'productId, warehouseId y quantity son requeridos' },
        { status: 400 }
      )
    }

    const qty = parseInt(String(quantity))
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Validate that the product exists and is active
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }
    if (!product.isActive) {
      return NextResponse.json(
        { error: 'El producto no está activo' },
        { status: 400 }
      )
    }

    // Validate that the warehouse exists and is active
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json(
        { error: 'Almacén no encontrado' },
        { status: 404 }
      )
    }
    if (!warehouse.isActive) {
      return NextResponse.json(
        { error: 'El almacén no está activo' },
        { status: 400 }
      )
    }

    // Execute all operations in a transaction
    const result = await db.$transaction(async (tx) => {
      // a. Upsert ProductStock for product+warehouse combination
      const productStock = await tx.productStock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        create: {
          productId,
          warehouseId,
          stock: qty,
        },
        update: {
          stock: { increment: qty },
        },
      })

      // b. Increment the Product total stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      })

      // c. Create InventoryMovement with type ENTRADA
      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          type: 'ENTRADA',
          quantity: qty,
          previousStock: updatedProduct.stock - qty,
          newStock: updatedProduct.stock,
          toWarehouseId: warehouseId,
          reason: reason || null,
        },
        include: {
          product: true,
          toWarehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
        },
      })

      return { productStock, updatedProduct, movement }
    })

    return NextResponse.json(
      {
        message: 'Stock recibido correctamente',
        stock: {
          productId: result.productStock.productId,
          warehouseId: result.productStock.warehouseId,
          warehouseStock: result.productStock.stock,
          totalProductStock: result.updatedProduct.stock,
        },
        movement: result.movement,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error receiving stock:', error)
    return NextResponse.json(
      { error: 'Error al recibir stock' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (productId) {
      where.productId = productId
    }

    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        include: {
          product: true,
          fromWarehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
          toWarehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.inventoryMovement.count({ where }),
    ])

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching inventory movements:', error)
    return NextResponse.json(
      { error: 'Error al obtener movimientos de inventario' },
      { status: 500 }
    )
  }
}
