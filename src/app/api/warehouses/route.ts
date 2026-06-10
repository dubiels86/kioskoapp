import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const warehouses = await db.warehouse.findMany({
      where: { isActive: true },
      include: {
        stocks: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { stocks: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Add stock summary for each warehouse
    const warehousesWithSummary = warehouses.map((warehouse) => {
      const totalStock = warehouse.stocks.reduce((sum, s) => sum + s.stock, 0)
      const totalProducts = warehouse.stocks.length
      const lowStockCount = warehouse.stocks.filter(
        (s) => s.stock <= s.minStock
      ).length

      return {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        type: warehouse.type,
        address: warehouse.address,
        isActive: warehouse.isActive,
        createdAt: warehouse.createdAt,
        updatedAt: warehouse.updatedAt,
        stockSummary: {
          totalStock,
          totalProducts,
          lowStockCount,
        },
        _count: warehouse._count,
      }
    })

    return NextResponse.json(warehousesWithSummary)
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { error: 'Error al obtener depósitos' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, code, type, address } = body

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    // Auto-generate code from name if not provided
    const warehouseCode = code || name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'WH'

    // Check code uniqueness, auto-increment if duplicate
    let finalCode = warehouseCode
    const existing = await db.warehouse.findUnique({ where: { code: finalCode } })
    if (existing) {
      // Append number to make unique
      let counter = 1
      while (await db.warehouse.findUnique({ where: { code: `${finalCode}${counter}` } })) {
        counter++
      }
      finalCode = `${finalCode}${counter}`
    }

    const warehouse = await db.warehouse.create({
      data: {
        name,
        code: finalCode,
        type: type || 'SECUNDARIO',
        address: address || null,
      },
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { error: 'Error al crear depósito' },
      { status: 500 }
    )
  }
}
