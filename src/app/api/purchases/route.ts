import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const purchases = await db.purchase.findMany({
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(purchases)
  } catch (error) {
    console.error('Error fetching purchases:', error)
    return NextResponse.json(
      { error: 'Error al obtener compras' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { supplierId, invoiceNumber, currencyCode, exchangeRate, notes, items, warehouseId } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'La compra debe tener al menos un item' },
        { status: 400 }
      )
    }

    // Validate warehouseId if provided
    if (warehouseId) {
      const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse || !warehouse.isActive) {
        return NextResponse.json(
          { error: 'Depósito no encontrado o inactivo' },
          { status: 400 }
        )
      }
    }

    const purchase = await db.$transaction(async (tx) => {
      // Calculate total from items
      let totalAmount = 0

      // Validate all products exist and get current stock
      const productIds = items.map((item: { productId: string }) => item.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      })

      const productMap = new Map(products.map((p) => [p.id, p]))

      // Determine warehouse for each item (item-level overrides global)
      const itemWarehouses: string[] = []
      for (const item of items) {
        const whId = item.warehouseId || warehouseId
        if (!whId) {
          const product = productMap.get(item.productId)
          throw new Error(`No se especificó depósito para el producto ${product?.name || item.productId}`)
        }
        itemWarehouses.push(whId)

        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`)
        }
        const subtotal = item.quantity * item.costPrice
        totalAmount += subtotal
      }

      // Create the purchase
      const newPurchase = await tx.purchase.create({
        data: {
          supplierId: supplierId || null,
          invoiceNumber: invoiceNumber || null,
          currencyCode: currencyCode || 'ARS',
          exchangeRate: exchangeRate || 1,
          totalAmount,
          status: 'RECIBIDA',
          notes: notes || null,
          items: {
            create: items.map((item: { productId: string; quantity: number; costPrice: number; costCurrency?: string; exchangeRate?: number }, index: number) => ({
              productId: item.productId,
              warehouseId: itemWarehouses[index],
              quantity: item.quantity,
              costPrice: parseFloat(item.costPrice),
              costCurrency: item.costCurrency || currencyCode || 'ARS',
              exchangeRate: item.exchangeRate || exchangeRate || 1,
              subtotal: item.quantity * parseFloat(item.costPrice),
            })),
          },
        },
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

      // Update stock and create inventory movements for each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const product = productMap.get(item.productId)!
        const whId = itemWarehouses[i]

        // Upsert ProductStock for the specific warehouse
        const existingStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: whId,
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
          await tx.productStock.create({
            data: {
              productId: item.productId,
              warehouseId: whId,
              stock: item.quantity,
              minStock: product.minStock,
            },
          })
        }

        // Increment Product.stock (total)
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
            toWarehouseId: whId,
            reason: `Compra ${newPurchase.id.slice(-8)}`,
            referenceId: newPurchase.id,
          },
        })
      }

      return newPurchase
    })

    return NextResponse.json(purchase, { status: 201 })
  } catch (error) {
    console.error('Error creating purchase:', error)
    const message = error instanceof Error ? error.message : 'Error al crear compra'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
