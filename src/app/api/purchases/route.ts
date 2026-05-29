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
    const { supplierId, invoiceNumber, notes, items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'La compra debe tener al menos un item' },
        { status: 400 }
      )
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

      for (const item of items) {
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
          totalAmount,
          status: 'RECIBIDA',
          notes: notes || null,
          items: {
            create: items.map((item: { productId: string; quantity: number; costPrice: number }) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: parseFloat(item.costPrice),
              subtotal: item.quantity * parseFloat(item.costPrice),
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      // Update stock and create inventory movements for each item
      for (const item of items) {
        const product = productMap.get(item.productId)!
        const previousStock = product.stock
        const newStock = previousStock + item.quantity

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        })

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'COMPRA',
            quantity: item.quantity,
            previousStock,
            newStock,
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
