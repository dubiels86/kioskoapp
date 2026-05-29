import { db } from '@/lib/db'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create warehouses
  const warehousePrincipal = await db.warehouse.create({
    data: {
      name: 'Depósito Principal',
      code: 'PRINCIPAL',
      type: 'PRINCIPAL',
      address: 'Depósito principal de stock',
      isActive: true,
    },
  })

  const warehouseVentas = await db.warehouse.create({
    data: {
      name: 'Local de Ventas',
      code: 'VENTAS',
      type: 'VENTAS',
      address: 'Local de atención al público',
      isActive: true,
    },
  })

  console.log('  - 2 almacenes creados (Principal y Ventas)')

  // Create categories
  const bebidas = await db.category.create({ data: { name: 'Bebidas', description: 'Gaseosas, jugos, agua' } })
  const snacks = await db.category.create({ data: { name: 'Snacks', description: 'Papas, galletas, caramelos' } })
  const cigarrillos = await db.category.create({ data: { name: 'Cigarrillos', description: 'Tabaco y cigarros' } })
  const golosinas = await db.category.create({ data: { name: 'Golosinas', description: 'Chicles, chocolates, alfajores' } })
  const otros = await db.category.create({ data: { name: 'Otros', description: 'Varios y artículos varios' } })

  // Create products
  const productsData = [
    { name: 'Coca-Cola 500ml', barcode: '7790866001234', costPrice: 450, salePrice: 700, stock: 24, minStock: 6, unit: 'unidad', categoryId: bebidas.id },
    { name: 'Pepsi 500ml', barcode: '7790866001235', costPrice: 420, salePrice: 650, stock: 18, minStock: 6, unit: 'unidad', categoryId: bebidas.id },
    { name: 'Agua Mineral 500ml', barcode: '7790866001236', costPrice: 200, salePrice: 350, stock: 30, minStock: 10, unit: 'unidad', categoryId: bebidas.id },
    { name: 'Jugo Ades 1L', barcode: '7790866001237', costPrice: 600, salePrice: 950, stock: 12, minStock: 4, unit: 'unidad', categoryId: bebidas.id },
    { name: 'Cerveza Quilmes 1L', barcode: '7790866001238', costPrice: 800, salePrice: 1300, stock: 15, minStock: 6, unit: 'unidad', categoryId: bebidas.id },
    { name: 'Papas Lays 90g', barcode: '7790866001239', costPrice: 500, salePrice: 800, stock: 20, minStock: 5, unit: 'unidad', categoryId: snacks.id },
    { name: 'Papas Pringles 110g', barcode: '7790866001240', costPrice: 900, salePrice: 1500, stock: 10, minStock: 3, unit: 'unidad', categoryId: snacks.id },
    { name: 'Galletas Oreo 6u', barcode: '7790866001241', costPrice: 400, salePrice: 700, stock: 16, minStock: 4, unit: 'unidad', categoryId: snacks.id },
    { name: 'Club Social 3u', barcode: '7790866001242', costPrice: 350, salePrice: 600, stock: 0, minStock: 4, unit: 'unidad', categoryId: snacks.id },
    { name: 'Marlboro Rojo 20', barcode: '7790866001243', costPrice: 2500, salePrice: 3500, stock: 8, minStock: 3, unit: 'paquete', categoryId: cigarrillos.id },
    { name: 'Phillips Morris 20', barcode: '7790866001244', costPrice: 2300, salePrice: 3200, stock: 10, minStock: 3, unit: 'paquete', categoryId: cigarrillos.id },
    { name: 'Chicle Beldent 2u', barcode: '7790866001245', costPrice: 150, salePrice: 300, stock: 30, minStock: 10, unit: 'unidad', categoryId: golosinas.id },
    { name: 'Alfajor Jorgito', barcode: '7790866001246', costPrice: 300, salePrice: 500, stock: 20, minStock: 5, unit: 'unidad', categoryId: golosinas.id },
    { name: 'Chocolate Aguila 25g', barcode: '7790866001247', costPrice: 350, salePrice: 600, stock: 2, minStock: 5, unit: 'unidad', categoryId: golosinas.id },
    { name: 'Pilas AA Duracell 2u', barcode: '7790866001248', costPrice: 1200, salePrice: 2000, stock: 5, minStock: 2, unit: 'paquete', categoryId: otros.id },
    { name: 'Cargador USB-C', barcode: '7790866001249', costPrice: 2500, salePrice: 4500, stock: 3, minStock: 2, unit: 'unidad', categoryId: otros.id },
    { name: 'Funda Celular Universal', costPrice: 800, salePrice: 1500, stock: 4, minStock: 2, unit: 'unidad', categoryId: otros.id },
  ]

  for (const p of productsData) {
    const totalStock = p.stock
    // Distribute stock: 60% to Principal, 40% to Ventas
    const principalStock = Math.ceil(totalStock * 0.6)
    const ventasStock = totalStock - principalStock

    const product = await db.product.create({
      data: {
        name: p.name,
        barcode: p.barcode,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        stock: totalStock,
        minStock: p.minStock,
        unit: p.unit,
        categoryId: p.categoryId,
      },
    })

    // Create ProductStock entries for both warehouses
    await db.productStock.create({
      data: {
        productId: product.id,
        warehouseId: warehousePrincipal.id,
        stock: principalStock,
        minStock: p.minStock,
      },
    })

    await db.productStock.create({
      data: {
        productId: product.id,
        warehouseId: warehouseVentas.id,
        stock: ventasStock,
        minStock: p.minStock,
      },
    })

    // Create initial inventory movement
    if (totalStock > 0) {
      await db.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'ENTRADA',
          quantity: totalStock,
          previousStock: 0,
          newStock: totalStock,
          reason: 'Stock inicial',
          toWarehouseId: warehousePrincipal.id,
        },
      })
    }
  }

  // Create suppliers
  await db.supplier.create({ data: { name: 'Distribuidora Sur', phone: '11-5555-1234', email: 'ventas@distsur.com', address: 'Av. Rivadavia 4567' } })
  await db.supplier.create({ data: { name: 'Mayorista del Centro', phone: '11-5555-5678', email: 'info@mcentro.com', address: 'Lavalle 890' } })
  await db.supplier.create({ data: { name: 'Nobleza Piccardo', phone: '0800-888-8765', address: 'Av. del Libertador 3456' } })

  console.log('✅ Seed completed!')
  console.log(`  - 2 almacenes creados`)
  console.log(`  - ${5} categorías creadas`)
  console.log(`  - ${productsData.length} productos creados (con stock por almacén)`)
  console.log(`  - 3 proveedores creados`)
}

seed()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
