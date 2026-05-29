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

    // Get all sales for the day
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
      },
      orderBy: { createdAt: 'desc' },
    })

    // Total sales
    const totalSalesCount = sales.length
    const totalSalesAmount = sales.reduce((sum, s) => sum + s.total, 0)
    const totalCostOfGoods = sales.reduce((sum, s) => sum + s.costTotal, 0)
    const grossProfit = totalSalesAmount - totalCostOfGoods

    // Sales grouped by payment method
    const salesByMethod = {
      EFECTIVO: { count: 0, total: 0 },
      TRANSFERENCIA: { count: 0, total: 0 },
      CUENTA_CASA: { count: 0, total: 0, costTotal: 0 },
    }

    for (const sale of sales) {
      const method = sale.paymentMethod as keyof typeof salesByMethod
      if (salesByMethod[method]) {
        salesByMethod[method].count++
        salesByMethod[method].total += sale.total
        if (method === 'CUENTA_CASA') {
          salesByMethod[method].costTotal += sale.costTotal
        }
      }
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

    return NextResponse.json({
      date,
      totalSalesCount,
      totalSalesAmount,
      totalCostOfGoods,
      grossProfit,
      salesByMethod,
      cashRegister: {
        open: openCashRegister,
        registers: cashRegisters,
      },
      sales,
    })
  } catch (error) {
    console.error('Error generating daily report:', error)
    return NextResponse.json(
      { error: 'Error al generar reporte diario' },
      { status: 500 }
    )
  }
}
