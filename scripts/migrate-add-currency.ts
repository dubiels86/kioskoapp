#!/usr/bin/env tsx
/**
 * Script para migrar datos existentes para agregar campos de moneda
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniciando migración de campos de moneda...\n')

  // 1. Actualizar productos existentes
  console.log('Actualizando productos existentes...')
  const products = await prisma.product.findMany()
  console.log(`Encontrados ${products.length} productos`)
  
  for (const product of products) {
    try {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          costCurrency: 'CUP',
          saleCurrency: 'CUP'
        }
      })
      console.log(`✓ Producto actualizado: ${product.name}`)
    } catch (error) {
      console.error(`✗ Error actualizando producto ${product.name}:`, error.message)
    }
  }

  // 2. Actualizar compras existentes
  console.log('\nActualizando compras existentes...')
  const purchases = await prisma.purchase.findMany()
  console.log(`Encontradas ${purchases.length} compras`)
  
  for (const purchase of purchases) {
    try {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          currencyCode: 'CUP',
          exchangeRate: 1
        }
      })
      console.log(`✓ Compra actualizada: ${purchase.id}`)
    } catch (error) {
      console.error(`✗ Error actualizando compra ${purchase.id}:`, error.message)
    }
  }

  // 3. Actualizar items de compra existentes
  console.log('\nActualizando items de compra existentes...')
  const purchaseItems = await prisma.purchaseItem.findMany()
  console.log(`Encontrados ${purchaseItems.length} items de compra`)
  
  for (const item of purchaseItems) {
    try {
      // Obtener la moneda de la compra padre
      const purchase = await prisma.purchase.findUnique({
        where: { id: item.purchaseId }
      })
      
      await prisma.purchaseItem.update({
        where: { id: item.id },
        data: {
          costCurrency: purchase?.currencyCode || 'CUP',
          exchangeRate: purchase?.exchangeRate || 1
        }
      })
      console.log(`✓ Item de compra actualizado: ${item.id}`)
    } catch (error) {
      console.error(`✗ Error actualizando item ${item.id}:`, error.message)
    }
  }

  console.log('\n✅ Migración completada exitosamente!')
}

main()
  .catch((error) => {
    console.error('❌ Error en migración:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })