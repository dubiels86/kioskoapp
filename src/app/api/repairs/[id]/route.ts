import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const repair = await db.repair.findUnique({
      where: { id },
      include: {
        parts: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!repair) {
      return NextResponse.json(
        { error: 'Reparación no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(repair)
  } catch (error) {
    console.error('Error fetching repair:', error)
    return NextResponse.json(
      { error: 'Error al obtener reparación' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      status,
      notes,
    } = body

    const existing = await db.repair.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Reparación no encontrada' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (customerName !== undefined) updateData.customerName = customerName
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone || null
    if (device !== undefined) updateData.device = device
    if (brand !== undefined) updateData.brand = brand || null
    if (model !== undefined) updateData.model = model || null
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber || null
    if (issue !== undefined) updateData.issue = issue
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis || null
    if (repairCost !== undefined) updateData.repairCost = parseFloat(repairCost)
    if (partsCost !== undefined) updateData.partsCost = parseFloat(partsCost)
    if (totalCost !== undefined) updateData.totalCost = parseFloat(totalCost)
    if (notes !== undefined) updateData.notes = notes || null

    // Handle status changes
    if (status !== undefined && status !== existing.status) {
      updateData.status = status

      if (status === 'REPARADO') {
        updateData.completedAt = new Date()
      }

      if (status === 'ENTREGADO') {
        updateData.deliveredAt = new Date()
        // Also set completedAt if not already set
        if (!existing.completedAt) {
          updateData.completedAt = new Date()
        }
      }
    }

    const updated = await db.repair.update({
      where: { id },
      data: updateData,
      include: {
        parts: {
          include: {
            product: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating repair:', error)
    return NextResponse.json(
      { error: 'Error al actualizar reparación' },
      { status: 500 }
    )
  }
}
