import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') || ''
    const fromParam = searchParams.get('from') || ''
    const toParam = searchParams.get('to') || ''

    let startDate: Date
    let endDate: Date
    let isRange = false

    if (fromParam && toParam) {
      // Date range mode
      startDate = new Date(fromParam + 'T00:00:00')
      endDate = new Date(toParam + 'T23:59:59')
      isRange = true
    } else {
      // Single day mode (backward compatible)
      const date = dateParam || new Date().toISOString().split('T')[0]
      startDate = new Date(date + 'T00:00:00')
      endDate = new Date(date + 'T23:59:59')
    }

    // Get all sales in the date range
    const sales = await db.sale.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        cashRegister: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Total sales
    const totalSalesCount = sales.length
    const totalSalesAmount = sales.reduce((sum, s) => sum + s.total, 0)
    const totalCostOfGoods = sales.reduce((sum, s) => sum + s.costTotal, 0)
    const grossProfit = totalSalesAmount - totalCostOfGoods
    const totalDiscount = sales.reduce((sum, s) => sum + s.discount, 0)

    // Sales grouped by payment method — use individual SalePayment records
    // so that MIXTO (split) sales are properly attributed to each method
    const normalizeMethod = (m: string) => m === 'TRANSFERENCIA' ? 'TARJETA' : m
    const salesByMethod: Record<string, { count: number; total: number; costTotal: number }> = {}

    for (const sale of sales) {
      if (sale.payments && sale.payments.length > 0) {
        // Use individual payment records for proper split attribution
        for (const payment of sale.payments) {
          const method = normalizeMethod(payment.method)
          if (!salesByMethod[method]) {
            salesByMethod[method] = { count: 0, total: 0, costTotal: 0 }
          }
          salesByMethod[method].count++
          salesByMethod[method].total += payment.amount
          // For CUENTA_CASA payments, attribute the sale's costTotal proportionally
          if (method === 'CUENTA_CASA' && sale.total > 0) {
            const proportion = payment.amount / sale.total
            salesByMethod[method].costTotal += sale.costTotal * proportion
          }
        }
      } else {
        // Fallback for legacy sales without payment records
        const method = normalizeMethod(sale.paymentMethod)
        if (!salesByMethod[method]) {
          salesByMethod[method] = { count: 0, total: 0, costTotal: 0 }
        }
        salesByMethod[method].count++
        salesByMethod[method].total += sale.total
        if (method === 'CUENTA_CASA') {
          salesByMethod[method].costTotal += sale.costTotal
        }
      }
    }

    // Ensure the 3 main methods always exist in the response
    if (!salesByMethod.EFECTIVO) salesByMethod.EFECTIVO = { count: 0, total: 0, costTotal: 0 }
    if (!salesByMethod.TARJETA) salesByMethod.TARJETA = { count: 0, total: 0, costTotal: 0 }
    if (!salesByMethod.CUENTA_CASA) salesByMethod.CUENTA_CASA = { count: 0, total: 0, costTotal: 0 }

    // Sales by day (for range charts)
    const salesByDay: Record<string, { count: number; total: number; costTotal: number }> = {}
    for (const sale of sales) {
      const day = sale.createdAt.toISOString().split('T')[0]
      if (!salesByDay[day]) salesByDay[day] = { count: 0, total: 0, costTotal: 0 }
      salesByDay[day].count++
      salesByDay[day].total += sale.total
      salesByDay[day].costTotal += sale.costTotal
    }

    // Top products
    const productSales: Record<string, { name: string; quantity: number; total: number; costTotal: number }> = {}
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.product.name, quantity: 0, total: 0, costTotal: 0 }
        }
        productSales[item.productId].quantity += item.quantity
        productSales[item.productId].total += item.subtotal
        productSales[item.productId].costTotal += item.costSubtotal
      }
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    // Expenses in the date range
    const expenses = await db.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    })

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const expensesByCategory: Record<string, number> = {}
    const expensesByPaymentMethod: Record<string, number> = {}
    for (const expense of expenses) {
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount
      expensesByPaymentMethod[expense.paymentMethod] = (expensesByPaymentMethod[expense.paymentMethod] || 0) + expense.amount
    }

    // Cash register info
    const cashRegisters = await db.cashRegister.findMany({
      where: {
        openedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        sales: true,
        movements: true,
      },
    })

    const openCashRegister = await db.cashRegister.findFirst({
      where: { status: 'ABIERTA' },
    })

    // Purchases in the date range
    const purchases = await db.purchase.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0)

    return NextResponse.json({
      date: isRange ? undefined : (dateParam || new Date().toISOString().split('T')[0]),
      fromDate: isRange ? fromParam : undefined,
      toDate: isRange ? toParam : undefined,
      isRange,
      totalSalesCount,
      totalSalesAmount,
      totalCostOfGoods,
      grossProfit,
      totalDiscount,
      salesByMethod,
      salesByDay,
      topProducts,
      totalExpenses,
      expensesByCategory,
      expensesByPaymentMethod,
      totalPurchases,
      cashRegister: {
        open: openCashRegister,
        registers: cashRegisters,
      },
      sales,
      expenses,
      purchases,
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Error al generar reporte' },
      { status: 500 }
    )
  }
}
