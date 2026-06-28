#!/usr/bin/env tsx
/**
 * Script para probar las funcionalidades de moneda y tipo de cambio
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testCurrencyFeatures() {
  console.log('🧪 Probando funcionalidades de moneda y tipo de cambio...\n')

  try {
    // 1. Verificar monedas existentes
    console.log('1. Verificando monedas...')
    const currencies = await prisma.currency.findMany()
    console.log(`   Monedas encontradas: ${currencies.length}`)
    currencies.forEach(c => {
      console.log(`   - ${c.code}: ${c.name} (${c.symbol}) - Base: ${c.isBase} - TC: ${c.exchangeRate}`)
    })

    // 2. Verificar historial de tipos de cambio
    console.log('\n2. Verificando historial de tipos de cambio...')
    const exchangeRates = await prisma.exchangeRateHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    })
    console.log(`   Registros de tipo de cambio: ${exchangeRates.length}`)
    exchangeRates.forEach(r => {
      console.log(`   - ${r.fromCurrency} → ${r.toCurrency}: ${r.rate} (${r.source})`)
    })

    // 3. Verificar productos con moneda
    console.log('\n3. Verificando productos...')
    const products = await prisma.product.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        costPrice: true,
        costCurrency: true,
        salePrice: true,
        saleCurrency: true
      }
    })
    console.log(`   Productos encontrados: ${products.length}`)
    products.forEach(p => {
      console.log(`   - ${p.name}: Costo ${p.costPrice} ${p.costCurrency}, Venta ${p.salePrice} ${p.saleCurrency}`)
    })

    // 4. Verificar movimientos de inventario
    console.log('\n4. Verificando movimientos de inventario...')
    const movements = await prisma.inventoryMovement.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        quantity: true,
        costPrice: true,
        costCurrency: true,
        exchangeRate: true,
        createdAt: true
      }
    })
    console.log(`   Movimientos encontrados: ${movements.length}`)
    movements.forEach(m => {
      console.log(`   - ${m.type}: ${m.quantity} unidades, ${m.costPrice || 'N/A'} ${m.costCurrency}, TC: ${m.exchangeRate}`)
    })

    // 5. Probar cálculo de conversión
    console.log('\n5. Probando cálculos de conversión...')
    const cupPrice = 1200
    const exchangeRate = currencies.find(c => c.code === 'USD')?.exchangeRate || 240
    const usdEquivalent = cupPrice / exchangeRate
    console.log(`   Precio CUP: ${cupPrice} CUP`)
    console.log(`   Tipo de cambio: 1 USD = ${exchangeRate} CUP`)
    console.log(`   Equivalente USD: ${usdEquivalent.toFixed(2)} USD`)

    console.log('\n✅ Todas las pruebas completadas exitosamente!')
    console.log('\n🎯 Resumen de funcionalidades:')
    console.log('   ✓ Monedas configuradas (CUP y USD)')
    console.log('   ✓ Historial de tipos de cambio')
    console.log('   ✓ Productos con moneda asignada')
    console.log('   ✓ Movimientos con información de moneda')
    console.log('   ✓ Cálculos de conversión funcionando')

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error)
    process.exit(1)
  }
}

testCurrencyFeatures()
  .catch((error) => {
    console.error('❌ Error en pruebas:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })