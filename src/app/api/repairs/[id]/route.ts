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
      include: { parts: { include: { product: true } } },
    })
    if (!repair) return NextResponse.json({ error: 'Reparación no encontrada' }, { status: 404 })
    return NextResponse.json(repair)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener reparación' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.repair.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Reparación no encontrada' }, { status: 404 })

    const {
      customerName, customerPhone, customerEmail,
      device, brand, model, serialNumber, condition,
      issue, diagnosis, priority,
      repairCost, partsCost, totalCost, deposit,
      estimatedDate, status, notes, internalNotes, parts,
    } = body

    const updateData: Record<string, unknown> = {}

    if (customerName !== undefined) updateData.customerName = customerName
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone || null
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail || null
    if (device !== undefined) updateData.device = device
    if (brand !== undefined) updateData.brand = brand || null
    if (model !== undefined) updateData.model = model || null
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber || null
    if (condition !== undefined) updateData.condition = condition || null
    if (issue !== undefined) updateData.issue = issue
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis || null
    if (priority !== undefined) updateData.priority = priority
    if (repairCost !== undefined) updateData.repairCost = parseFloat(repairCost) || 0
    if (partsCost !== undefined) updateData.partsCost = parseFloat(partsCost) || 0
    if (totalCost !== undefined) updateData.totalCost = parseFloat(totalCost) || 0
    if (deposit !== undefined) updateData.deposit = parseFloat(deposit) || 0
    if (estimatedDate !== undefined) updateData.estimatedDate = estimatedDate ? new Date(estimatedDate) : null
    if (notes !== undefined) updateData.notes = notes || null
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null

    // Status transitions with timestamps
    if (status !== undefined && status !== existing.status) {
      updateData.status = status
      if (status === 'REPARADO') updateData.completedAt = new Date()
      if (status === 'ENTREGADO') {
        updateData.deliveredAt = new Date()
        if (!existing.completedAt) updateData.completedAt = new Date()
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const repair = await tx.repair.update({
        where: { id },
        data: updateData,
      })

      // Replace parts if provided
      if (parts !== undefined) {
        await tx.repairPart.deleteMany({ where: { repairId: id } })
        if (parts.length > 0) {
          await tx.repairPart.createMany({
            data: parts.map((p: { productId?: string; partName: string; quantity?: number; costPrice?: number; salePrice?: number }) => ({
              repairId: id,
              productId: p.productId || null,
              partName: p.partName,
              quantity: p.quantity || 1,
              costPrice: parseFloat(p.costPrice as unknown as string) || 0,
              salePrice: parseFloat(p.salePrice as unknown as string) || 0,
            })),
          })
        }
      }

      return tx.repair.findUnique({
        where: { id: repair.id },
        include: { parts: { include: { product: true } } },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating repair:', error)
    return NextResponse.json({ error: 'Error al actualizar reparación' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.repair.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar reparación' }, { status: 500 })
  }
}
