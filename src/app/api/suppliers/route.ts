import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    })

    const result = suppliers.map((s) => ({
      ...s,
      purchaseCount: s._count.purchases,
      _count: undefined,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Error al obtener proveedores' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, phone, email, address } = body

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const supplier = await db.supplier.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Error al crear proveedor' },
      { status: 500 }
    )
  }
}
