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
      warehouseId, // Global warehouse for all items
      payments, // Array of { method, amount }
      tableNumber, // Mesa number (cafeteria mode)
      cashReceived, // Efectivo entregado por el cliente
      changeAmount, // Vuelto entregado al cliente
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

    // Validate payments
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: 'Debe especificar al menos un medio de pago' },
        { status: 400 }
      )
    }

    for (const p of payments) {
      if (!p.method || p.amount === undefined || p.amount <= 0) {
        return NextResponse.json(
          { error: 'Cada medio de pago debe tener un método y un monto válido' },
          { status: 400 }
        )
      }
    }

    // Validate payments sum >= total (we'll check after calculating total below)

    // Validate global warehouseId if provided
    if (warehouseId) {
      const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse || !warehouse.isActive) {
        return NextResponse.json(
          { error: 'Depósito no encontrado o inactivo' },
          { status: 400 }
        )
      }
    }

    const sale = await db.$transaction(async (tx) => {
      // Get all products for validation
      const productIds = items.map((item: { productId: string }) => item.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      })
      const productMap = new Map(products.map((p) => [p.id, p]))

      // Determine warehouse for each item (item-level overrides global)
      const itemWarehouses = items.map((item: { productId: string; warehouseId?: string }) => {
        const whId = item.warehouseId || warehouseId
        if (!whId) {
          throw new Error(`No se especificó depósito para el producto ${productMap.get(item.productId)?.name || item.productId}`)
        }
        return whId
      })

      // Validate warehouse stock availability
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`)
        }

        const whId = itemWarehouses[i]
        const productStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: whId,
            },
          },
        })

        if (!productStock) {
          const warehouse = await tx.warehouse.findUnique({ where: { id: whId } })
          throw new Error(`No hay stock de ${product.name} en el depósito ${warehouse?.name || whId}`)
        }

        if (productStock.stock < item.quantity) {
          const warehouse = await tx.warehouse.findUnique({ where: { id: whId } })
          throw new Error(`Stock insuficiente de ${product.name} en ${warehouse?.name || whId}. Disponible: ${productStock.stock}`)
        }
      }

      // Calculate totals
      let subtotal = 0
      let costTotal = 0
      const saleItemsData = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const product = productMap.get(item.productId)!
        const itemSubtotal = item.quantity * product.salePrice
        const itemCostSubtotal = item.quantity * product.costPrice
        subtotal += itemSubtotal
        costTotal += itemCostSubtotal

        saleItemsData.push({
          productId: item.productId,
          warehouseId: itemWarehouses[i],
          quantity: item.quantity,
          costPrice: product.costPrice,
          salePrice: product.salePrice,
          subtotal: itemSubtotal,
          costSubtotal: itemCostSubtotal,
        })
      }

      const discountAmount = discount ? parseFloat(discount) : 0
      const total = subtotal - discountAmount

      // Validate that payments sum >= total
      const paymentsSum = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
      if (paymentsSum < total) {
        throw new Error(`Los pagos ($${paymentsSum.toFixed(2)}) no cubren el total ($${total.toFixed(2)})`)
      }

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
      // If ALL payments are CUENTA_CASA, it's a MERMA; otherwise VENTA
      const allCuentaCasa = payments.every((p: { method: string }) => p.method === 'CUENTA_CASA')
      const movementType = allCuentaCasa ? 'MERMA' : 'VENTA'

      // Create the sale with payments
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          cashRegisterId: cashRegisterId || null,
          paymentMethod,
          subtotal,
          discount: discountAmount,
          total,
          costTotal,
          cashReceived: cashReceived || null,
          changeAmount: changeAmount || null,
          tableNumber: tableNumber || null,
          customerName: customerName || null,
          notes: notes || null,
          items: {
            create: saleItemsData,
          },
          payments: {
            create: payments.map((p: { method: string; amount: number }) => ({
              method: p.method,
              amount: p.amount,
            })),
          },
        },
        include: {
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
          payments: true,
          cashRegister: true,
        },
      })

      // Update warehouse stock and total stock for each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const product = productMap.get(item.productId)!
        const whId = itemWarehouses[i]

        // Decrement ProductStock for the specific warehouse
        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: whId,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        })

        // Decrement Product.stock (total)
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        })

        // Create InventoryMovement
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: movementType,
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: updatedProduct.stock,
            fromWarehouseId: whId,
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
