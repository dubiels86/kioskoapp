import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') || ''

    // Default to today if no date provided
    const date = dateParam || new Date().toISOString().split('T')[0]
    const startDate = new Date(date + 'T00:00:00')
    const endDate = new Date(date + 'T23:59:59')

    // Get all sales for the day with items and products
    const sales = await db.sale.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        paymentMethod: { not: 'CUENTA_CASA' } // Excluir CUENTA_CASA
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Group sales by category
    const categoriesMap = new Map<string, {
      categoryName: string
      products: Map<string, {
        productId: string
        productName: string
        quantitySold: number
        saleAmount: number
        costAmount: number
        profit: number
      }>
      totalQuantity: number
      totalSaleAmount: number
      totalCostAmount: number
      totalProfit: number
    }>()

    // Process each sale
    for (const sale of sales) {
      for (const item of sale.items) {
        const product = item.product
        const categoryId = product.categoryId || 'SIN_CATEGORIA'
        const categoryName = product.category?.name || 'Sin Categoría'

        // Get or create category
        if (!categoriesMap.has(categoryId)) {
          categoriesMap.set(categoryId, {
            categoryName,
            products: new Map(),
            totalQuantity: 0,
            totalSaleAmount: 0,
            totalCostAmount: 0,
            totalProfit: 0,
          })
        }

        const category = categoriesMap.get(categoryId)!

        // Get or create product within category
        if (!category.products.has(product.id)) {
          category.products.set(product.id, {
            productId: product.id,
            productName: product.name,
            quantitySold: 0,
            saleAmount: 0,
            costAmount: 0,
            profit: 0,
          })
        }

        const productData = category.products.get(product.id)!

        // Update totals
        productData.quantitySold += item.quantity
        productData.saleAmount += item.subtotal
        productData.costAmount += item.costSubtotal
        productData.profit += (item.subtotal - item.costSubtotal)

        // Update category totals
        category.totalQuantity += item.quantity
        category.totalSaleAmount += item.subtotal
        category.totalCostAmount += item.costSubtotal
        category.totalProfit += (item.subtotal - item.costSubtotal)
      }
    }

    // Convert to array format
    const categoriesData = Array.from(categoriesMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.categoryName,
      products: Array.from(data.products.values()),
      totalQuantity: data.totalQuantity,
      totalSaleAmount: data.totalSaleAmount,
      totalCostAmount: data.totalCostAmount,
      totalProfit: data.totalProfit,
    }))

    // Sort categories by total sale amount (descending)
    categoriesData.sort((a, b) => b.totalSaleAmount - a.totalSaleAmount)

    // Sort products within each category by quantity sold (descending)
    categoriesData.forEach(category => {
      category.products.sort((a, b) => b.quantitySold - a.quantitySold)
    })

    // Get POS warehouse (VENTAS type) stock
    const posWarehouse = await db.warehouse.findFirst({
      where: {
        type: 'VENTAS',
        isActive: true,
      },
    })

    let posStockData: any[] = []
    if (posWarehouse) {
      // Get all products that have stock in POS warehouse and are marked for POS
      posStockData = await db.product.findMany({
        where: {
          isPosProduct: true,
          isActive: true,
        },
        include: {
          category: true,
          stocks: {
            where: {
              warehouseId: posWarehouse.id,
            },
          },
        },
        orderBy: [
          { category: { name: 'asc' } },
          { name: 'asc' },
        ],
      })
    }

    return NextResponse.json({
      date,
      categoriesData,
      posWarehouse: posWarehouse ? {
        id: posWarehouse.id,
        name: posWarehouse.name,
      } : null,
      posStockData: posStockData.map(product => ({
        productId: product.id,
        productName: product.name,
        categoryName: product.category?.name || 'Sin Categoría',
        barcode: product.barcode,
        salePrice: product.salePrice,
        costPrice: product.costPrice,
        posStock: product.stocks[0]?.stock || 0,
        minStock: product.stocks[0]?.minStock || product.minStock,
        unit: product.unit,
        isLowStock: product.stocks[0]?.stock <= product.stocks[0]?.minStock,
      })),
    })
  } catch (error) {
    console.error('Error generating sales by category report:', error)
    return NextResponse.json(
      { error: 'Error al generar reporte de ventas por categoría' },
      { status: 500 }
    )
  }
}