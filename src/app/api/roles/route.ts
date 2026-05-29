import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const roles = await db.role.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: JSON.parse(r.permissions),
        isActive: r.isActive,
        userCount: r._count.users,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    )
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, permissions } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const existing = await db.role.findUnique({ where: { name: name.trim() } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 })
    }

    const role = await db.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        permissions: JSON.stringify(permissions || []),
      },
    })

    return NextResponse.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: JSON.parse(role.permissions),
      isActive: role.isActive,
      userCount: 0,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 })
  }
}
