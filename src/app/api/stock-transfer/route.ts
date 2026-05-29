import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productId, fromWarehouseId, toWarehouseId, quantity, reason } = body

    // Validate required fields
    if (!productId || !fromWarehouseId || !toWarehouseId || !quantity) {
      return NextResponse.json(
        { error: 'productId, fromWarehouseId, toWarehouseId y quantity son requeridos' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json(
        { error: 'Los depósitos de origen y destino no pueden ser el mismo' },
        { status: 400 }
      )
    }

    const movement = await db.$transaction(async (tx) => {
      // Validate both warehouses exist and are active
      const [fromWarehouse, toWarehouse] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: fromWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: toWarehouseId } }),
      ])

      if (!fromWarehouse || !fromWarehouse.isActive) {
        throw new Error('Depósito de origen no encontrado o inactivo')
      }
      if (!toWarehouse || !toWarehouse.isActive) {
        throw new Error('Depósito de destino no encontrado o inactivo')
      }

      // Validate product exists
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) {
        throw new Error('Producto no encontrado')
      }

      // Get source warehouse stock
      const sourceStock = await tx.productStock.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: fromWarehouseId,
          },
        },
      })

      if (!sourceStock) {
        throw new Error(`No hay stock del producto ${product.name} en el depósito ${fromWarehouse.name}`)
      }

      if (sourceStock.stock < quantity) {
        throw new Error(`Stock insuficiente en ${fromWarehouse.name}. Disponible: ${sourceStock.stock}, Solicitado: ${quantity}`)
      }

      // Decrement source warehouse stock
      const updatedSourceStock = await tx.productStock.update({
        where: { id: sourceStock.id },
        data: { stock: sourceStock.stock - quantity },
      })

      // Upsert destination warehouse stock (create if doesn't exist)
      const existingDestStock = await tx.productStock.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: toWarehouseId,
          },
        },
      })

      let updatedDestStock
      if (existingDestStock) {
        updatedDestStock = await tx.productStock.update({
          where: { id: existingDestStock.id },
          data: { stock: existingDestStock.stock + quantity },
        })
      } else {
        updatedDestStock = await tx.productStock.create({
          data: {
            productId,
            warehouseId: toWarehouseId,
            stock: quantity,
            minStock: product.minStock,
          },
        })
      }

      // Update Product.stock (total across all warehouses remains the same for transfer)
      // No need to update Product.stock since total stays the same
      // But we still update it to recalculate in case of drift
      const allStocks = await tx.productStock.findMany({
        where: { productId },
      })
      const totalStock = allStocks.reduce((sum, s) => sum + s.stock, 0)

      await tx.product.update({
        where: { id: productId },
        data: { stock: totalStock },
      })

      // Create InventoryMovement with type TRANSFERENCIA
      const inventoryMovement = await tx.inventoryMovement.create({
        data: {
          productId,
          type: 'TRANSFERENCIA',
          quantity,
          previousStock: product.stock,
          newStock: totalStock,
          fromWarehouseId,
          toWarehouseId,
          reason: reason || `Transferencia de ${fromWarehouse.name} a ${toWarehouse.name}`,
        },
        include: {
          product: true,
          fromWarehouse: true,
          toWarehouse: true,
        },
      })

      return {
        movement: inventoryMovement,
        sourceStock: updatedSourceStock,
        destinationStock: updatedDestStock,
      }
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('Error creating stock transfer:', error)
    const message = error instanceof Error ? error.message : 'Error al crear transferencia'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
