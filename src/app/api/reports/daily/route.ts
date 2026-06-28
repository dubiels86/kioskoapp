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
        payments: true,
        cashRegister: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Total sales
    const totalSalesCount = sales.length
    const totalSalesAmount = sales.reduce((sum, s) => sum + s.total, 0)
    const totalCostOfGoods = sales.reduce((sum, s) => sum + s.costTotal, 0)
    const grossProfit = totalSalesAmount - totalCostOfGoods

    // Sales grouped by payment method for mixed payments
    const normalizeMethod = (m: string) => m === 'TRANSFERENCIA' ? 'TARJETA' : m
    const salesByMethod = {
      EFECTIVO: { count: 0, total: 0 },
      TARJETA: { count: 0, total: 0 },
      CUENTA_CASA: { count: 0, total: 0, costTotal: 0 },
    }

    // Also track mixed payments
    const mixedPaymentsData: Record<string, { cash: number; card: number }> = {}
    
    for (const sale of sales) {
      // For old sales with single payment method
      if (!sale.payments || sale.payments.length === 0) {
        const method = normalizeMethod(sale.paymentMethod) as keyof typeof salesByMethod
        if (salesByMethod[method]) {
          salesByMethod[method].count++
          salesByMethod[method].total += sale.total
          if (method === 'CUENTA_CASA') {
            salesByMethod[method].costTotal += sale.costTotal
          }
        }
      } else {
        // For sales with multiple payments
        const salePaymentMethods = new Set(sale.payments.map(p => p.method))
        
        // If it's a mixed payment (EFECTIVO + TARJETA)
        if (salePaymentMethods.size > 1) {
          const cashAmount = sale.payments.filter(p => p.method === 'EFECTIVO').reduce((sum, p) => sum + p.amount, 0)
          const cardAmount = sale.payments.filter(p => p.method === 'TARJETA').reduce((sum, p) => sum + p.amount, 0)
          
          // Add to totals
          salesByMethod.EFECTIVO.total += cashAmount
          salesByMethod.TARJETA.total += cardAmount
          
          // Track the mixed payment
          mixedPaymentsData[sale.id] = { cash: cashAmount, card: cardAmount }
        } else {
          // Single payment method in payments array
          const method = normalizeMethod(sale.payments[0].method) as keyof typeof salesByMethod
          if (salesByMethod[method]) {
            salesByMethod[method].count++
            salesByMethod[method].total += sale.total
            if (method === 'CUENTA_CASA') {
              salesByMethod[method].costTotal += sale.costTotal
            }
          }
        }
      }
    }
    
    // Add mixed payments to counts
    salesByMethod.EFECTIVO.count += Object.keys(mixedPaymentsData).length
    salesByMethod.TARJETA.count += Object.keys(mixedPaymentsData).length

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
      mixedPaymentsData: Object.keys(mixedPaymentsData).length > 0 ? mixedPaymentsData : undefined,
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
