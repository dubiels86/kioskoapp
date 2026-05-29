import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || ''
    const cashRegisterId = searchParams.get('cashRegisterId') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''

    const where: Record<string, unknown> = {}

    if (date) {
      const startDate = new Date(date + 'T00:00:00')
      const endDate = new Date(date + 'T23:59:59')
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      }
    }

    if (cashRegisterId) {
      where.cashRegisterId = cashRegisterId
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    const sales = await db.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        cashRegister: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { error: 'Error al obtener ventas' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      cashRegisterId,
      paymentMethod,
      discount,
      customerName,
      notes,
      items,
    } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'La venta debe tener al menos un item' },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'El método de pago es requerido' },
        { status: 400 }
      )
    }

    const sale = await db.$transaction(async (tx) => {
      // Get all products for validation
      const productIds = items.map((item: { productId: string }) => item.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      })
      const productMap = new Map(products.map((p) => [p.id, p]))

      // Validate stock availability
      for (const item of items) {
        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`)
        }
        if (product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`)
        }
      }

      // Calculate totals
      let subtotal = 0
      let costTotal = 0
      const saleItemsData = []

      for (const item of items) {
        const product = productMap.get(item.productId)!
        const itemSubtotal = item.quantity * product.salePrice
        const itemCostSubtotal = item.quantity * product.costPrice
        subtotal += itemSubtotal
        costTotal += itemCostSubtotal

        saleItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          costPrice: product.costPrice,
          salePrice: product.salePrice,
          subtotal: itemSubtotal,
          costSubtotal: itemCostSubtotal,
        })
      }

      const discountAmount = discount ? parseFloat(discount) : 0
      const total = subtotal - discountAmount

      // Generate invoice number
      const latestSale = await tx.sale.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      })

      let nextNumber = 1
      if (latestSale) {
        const match = latestSale.invoiceNumber.match(/V-(\d+)/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }
      const invoiceNumber = `V-${nextNumber.toString().padStart(6, '0')}`

      // Determine inventory movement type
      const movementType = paymentMethod === 'CUENTA_CASA' ? 'MERMA' : 'VENTA'

      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          cashRegisterId: cashRegisterId || null,
          paymentMethod,
          subtotal,
          discount: discountAmount,
          total,
          costTotal,
          customerName: customerName || null,
          notes: notes || null,
          items: {
            create: saleItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          cashRegister: true,
        },
      })

      // Update stock and create inventory movements
      for (const item of items) {
        const product = productMap.get(item.productId)!
        const previousStock = product.stock
        const newStock = previousStock - item.quantity

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        })

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: movementType,
            quantity: item.quantity,
            previousStock,
            newStock,
            reason: `Venta ${invoiceNumber}`,
            referenceId: newSale.id,
          },
        })
      }

      return newSale
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    const message = error instanceof Error ? error.message : 'Error al crear venta'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
