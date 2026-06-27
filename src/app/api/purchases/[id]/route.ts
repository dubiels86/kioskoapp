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
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
              },
            },
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
    const { status, warehouseId } = body

    const existing = await db.purchase.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      )
    }

    // If status is changing to RECIBIDA, process stock
    if (status === 'RECIBIDA' && existing.status !== 'RECIBIDA') {
      // Validate warehouseId
      if (!warehouseId) {
        return NextResponse.json(
          { error: 'Se requiere especificar un depósito para recibir la compra' },
          { status: 400 }
        )
      }

      const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse || !warehouse.isActive) {
        return NextResponse.json(
          { error: 'Depósito no encontrado o inactivo' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // Update each purchase item with warehouseId and update stock
        for (const item of existing.items) {
          // Update the PurchaseItem with warehouseId
          await tx.purchaseItem.update({
            where: { id: item.id },
            data: { warehouseId },
          })

          // Upsert ProductStock for the warehouse
          const existingStock = await tx.productStock.findUnique({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId,
              },
            },
          })

          if (existingStock) {
            await tx.productStock.update({
              where: { id: existingStock.id },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            })
          } else {
            const product = await tx.product.findUnique({ where: { id: item.productId } })
            await tx.productStock.create({
              data: {
                productId: item.productId,
                warehouseId,
                stock: item.quantity,
                minStock: product?.minStock ?? 5,
              },
            })
          }

          // Increment Product.stock (total)
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (product) {
            const updatedProduct = await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            })

            // Create InventoryMovement with COMPRA type and toWarehouseId
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: 'COMPRA',
                quantity: item.quantity,
                previousStock: product.stock,
                newStock: updatedProduct.stock,
                toWarehouseId: warehouseId,
                reason: `Recepción de compra ${existing.id.slice(-8)}`,
                referenceId: existing.id,
              },
            })

            // Calculate weighted average cost price
            const purchaseItemCostPrice = item.costPrice
            if (purchaseItemCostPrice !== undefined && purchaseItemCostPrice > 0) {
              const previousStock = product.stock // stock before increment
              if (previousStock > 0) {
                const weightedAvg = (previousStock * product.costPrice + item.quantity * purchaseItemCostPrice) / updatedProduct.stock
                await tx.product.update({
                  where: { id: item.productId },
                  data: { costPrice: Math.round(weightedAvg * 100) / 100 },
                })
              } else {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { costPrice: purchaseItemCostPrice },
                })
              }
            }
          }
        }

        // Update the purchase status
        const updated = await tx.purchase.update({
          where: { id },
          data: { status: 'RECIBIDA' },
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
                warehouse: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    type: true,
                  },
                },
              },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // For other status changes, just update
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
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating purchase:', error)
    const message = error instanceof Error ? error.message : 'Error al actualizar compra'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
