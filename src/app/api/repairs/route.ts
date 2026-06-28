import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

async function generateTicketNumber(): Promise<string> {
  const latest = await db.repair.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { ticketNumber: true },
  })
  let next = 1
  if (latest?.ticketNumber) {
    const match = latest.ticketNumber.match(/R-(\d+)/)
    if (match) next = parseInt(match[1]) + 1
  }
  return `R-${next.toString().padStart(5, '0')}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { ticketNumber: { contains: search } },
        { device: { contains: search } },
        { brand: { contains: search } },
        { model: { contains: search } },
      ]
    }

    const repairs = await db.repair.findMany({
      where,
      include: { parts: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(repairs)
  } catch (error) {
    console.error('Error fetching repairs:', error)
    return NextResponse.json({ error: 'Error al obtener reparaciones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customerName, customerPhone, customerEmail,
      device, brand, model, serialNumber, condition,
      issue, diagnosis, priority,
      repairCost, partsCost, totalCost, deposit,
      estimatedDate, notes, internalNotes, parts,
    } = body

    if (!customerName || !device || !issue) {
      return NextResponse.json(
        { error: 'Nombre del cliente, dispositivo y problema son requeridos' },
        { status: 400 }
      )
    }

    const ticketNumber = await generateTicketNumber()

    const repair = await db.repair.create({
      data: {
        ticketNumber,
        customerName,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        device,
        brand: brand || null,
        model: model || null,
        serialNumber: serialNumber || null,
        condition: condition || null,
        issue,
        diagnosis: diagnosis || null,
        priority: priority || 'NORMAL',
        repairCost: parseFloat(repairCost) || 0,
        partsCost: parseFloat(partsCost) || 0,
        totalCost: parseFloat(totalCost) || 0,
        deposit: parseFloat(deposit) || 0,
        estimatedDate: estimatedDate ? new Date(estimatedDate) : null,
        notes: notes || null,
        internalNotes: internalNotes || null,
        parts: parts?.length ? {
          create: parts.map((p: { productId?: string; partName: string; quantity?: number; costPrice?: number; salePrice?: number }) => ({
            productId: p.productId || null,
            partName: p.partName,
            quantity: p.quantity || 1,
            costPrice: parseFloat(p.costPrice as unknown as string) || 0,
            salePrice: parseFloat(p.salePrice as unknown as string) || 0,
          })),
        } : undefined,
      },
      include: { parts: { include: { product: true } } },
    })

    return NextResponse.json(repair, { status: 201 })
  } catch (error) {
    console.error('Error creating repair:', error)
    return NextResponse.json({ error: 'Error al crear reparación' }, { status: 500 })
  }
}
