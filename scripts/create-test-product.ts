#!/usr/bin/env tsx
/**
 * Script para crear un producto de prueba
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Creando producto de prueba...\n')

  try {
    // Primero, crear una categoría de prueba
    const category = await prisma.category.create({
      data: {
        name: 'Electrónica',
        description: 'Productos electrónicos de prueba',
      },
    })
    console.log(`✅ Categoría creada: ${category.name}`)

    // Crear producto de prueba
    const product = await prisma.product.create({
      data: {
        name: 'Producto de Prueba',
        barcode: 'TEST001',
        sku: 'SKU001',
        categoryId: category.id,
        costPrice: 100,
        salePrice: 150,
        costCurrency: 'CUP',
        saleCurrency: 'CUP',
        stock: 0,
        minStock: 5,
        unit: 'unidad',
        isPosProduct: true,
        isActive: true,
      },
    })
    console.log(`✅ Producto creado: ${product.name} (ID: ${product.id})`)

    // Crear almacén de prueba
    const warehouse = await prisma.warehouse.create({
      data: {
        name: 'Almacén Principal',
        code: 'ALM-001',
        type: 'PRINCIPAL',
        address: 'Dirección de prueba',
        isActive: true,
      },
    })
    console.log(`✅ Almacén creado: ${warehouse.name} (ID: ${warehouse.id})`)

    console.log('\n🎉 Producto y almacén de prueba creados correctamente!')
    console.log(`\nPara probar la API de inventario, usa:`)
    console.log(`POST /api/inventory`)
    console.log(`Body:`)
    console.log(`{\n  "productId": "${product.id}",`)
    console.log(`  "warehouseId": "${warehouse.id}",`)
    console.log(`  "quantity": 10,\n  "reason": "Compra inicial",`)
    console.log(`  "costPrice": 100,\n  "costCurrency": "CUP",`)
    console.log(`  "exchangeRate": 1\n}`)

  } catch (error) {
    console.error('❌ Error creando producto de prueba:', error)
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })