import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const repairs = await db.repair.findMany({
      where,
      include: {
        parts: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(repairs)
  } catch (error) {
    console.error('Error fetching repairs:', error)
    return NextResponse.json(
      { error: 'Error al obtener reparaciones' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customerName,
      customerPhone,
      device,
      brand,
      model,
      serialNumber,
      issue,
      diagnosis,
      repairCost,
      partsCost,
      totalCost,
      notes,
      parts,
    } = body

    if (!customerName || !device || !issue) {
      return NextResponse.json(
        { error: 'Nombre del cliente, dispositivo y problema son requeridos' },
        { status: 400 }
      )
    }

    const repair = await db.repair.create({
      data: {
        customerName,
        customerPhone: customerPhone || null,
        device,
        brand: brand || null,
        model: model || null,
        serialNumber: serialNumber || null,
        issue,
        diagnosis: diagnosis || null,
        repairCost: repairCost ? parseFloat(repairCost) : 0,
        partsCost: partsCost ? parseFloat(partsCost) : 0,
        totalCost: totalCost ? parseFloat(totalCost) : 0,
        notes: notes || null,
        parts: parts
          ? {
              create: parts.map((part: { productId?: string; partName: string; quantity?: number; costPrice?: number; salePrice?: number }) => ({
                productId: part.productId || null,
                partName: part.partName,
                quantity: part.quantity || 1,
                costPrice: part.costPrice ? parseFloat(part.costPrice) : 0,
                salePrice: part.salePrice ? parseFloat(part.salePrice) : 0,
              })),
            }
          : undefined,
      },
      include: {
        parts: {
          include: {
            product: true,
          },
        },
      },
    })

    return NextResponse.json(repair, { status: 201 })
  } catch (error) {
    console.error('Error creating repair:', error)
    return NextResponse.json(
      { error: 'Error al crear reparación' },
      { status: 500 }
    )
  }
}
