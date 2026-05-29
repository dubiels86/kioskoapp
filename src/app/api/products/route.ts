import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const active = searchParams.get('active')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { barcode: { contains: search } },
        { sku: { contains: search } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (active !== null) {
      where.isActive = active === 'true'
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      barcode,
      sku,
      categoryId,
      costPrice,
      salePrice,
      stock,
      minStock,
      unit,
    } = body

    if (!name || costPrice === undefined || costPrice === null || salePrice === undefined || salePrice === null) {
      return NextResponse.json(
        { error: 'Nombre, precio de costo y precio de venta son requeridos' },
        { status: 400 }
      )
    }

    // Check barcode uniqueness
    if (barcode) {
      const existing = await db.product.findUnique({ where: { barcode } })
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese código de barras' },
          { status: 400 }
        )
      }
    }

    // Check SKU uniqueness
    if (sku) {
      const existingSku = await db.product.findUnique({ where: { sku } })
      if (existingSku) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese SKU' },
          { status: 400 }
        )
      }
    }

    const initialStock = stock ?? 0

    const product = await db.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          barcode: barcode || null,
          sku: sku || null,
          categoryId: categoryId || null,
          costPrice: parseFloat(costPrice),
          salePrice: parseFloat(salePrice),
          stock: initialStock,
          minStock: minStock ?? 5,
          unit: unit || 'unidad',
        },
        include: {
          category: true,
        },
      })

      // Create initial inventory movement if stock > 0
      if (initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: newProduct.id,
            type: 'ENTRADA',
            quantity: initialStock,
            previousStock: 0,
            newStock: initialStock,
            reason: 'Stock inicial',
          },
        })
      }

      return newProduct
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    )
  }
}
