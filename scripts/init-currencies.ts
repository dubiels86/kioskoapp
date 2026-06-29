#!/usr/bin/env tsx
/**
 * Script para inicializar las monedas USD y CUP en la base de datos
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Inicializando monedas USD y CUP...\n')

  // Verificar si ya existen monedas
  const existingCurrencies = await prisma.currency.findMany()
  
  if (existingCurrencies.length > 0) {
    console.log(`Ya existen ${existingCurrencies.length} monedas en la base de datos:`)
    existingCurrencies.forEach(c => {
      console.log(`- ${c.code} (${c.name}): ${c.symbol} - Base: ${c.isBase}`)
    })
    console.log('\nNo se realizarán cambios.')
    return
  }

  // Crear monedas por defecto
  const currencies = [
    {
      code: 'CUP',
      name: 'Peso Cubano',
      symbol: '$MN',
      locale: 'es-CU',
      isBase: true, // Moneda base del sistema
      exchangeRate: 1,
      isActive: true,
    },
    {
      code: 'USD',
      name: 'Dólar Estadounidense',
      symbol: 'US$',
      locale: 'en-US',
      isBase: false,
      exchangeRate: 240, // Tipo de cambio inicial aproximado
      isActive: true,
    },
  ]

  for (const currencyData of currencies) {
    try {
      const currency = await prisma.currency.create({
        data: currencyData,
      })
      console.log(`✅ Moneda creada: ${currency.code} (${currency.name})`)
      
      // Registrar tipo de cambio inicial si no es moneda base
      if (!currencyData.isBase) {
        await prisma.exchangeRateHistory.create({
          data: {
            fromCurrency: 'USD',
            toCurrency: 'CUP',
            rate: currencyData.exchangeRate,
            source: 'manual',
          },
        })
        console.log(`   Tipo de cambio registrado: 1 USD = ${currencyData.exchangeRate} CUP`)
      }
    } catch (error) {
      console.error(`❌ Error creando moneda ${currencyData.code}:`, error.message)
    }
  }

  console.log('\n🎉 Monedas inicializadas correctamente!')
  console.log('\nMonedas disponibles:')
  console.log('- CUP: Moneda base del sistema (Peso Cubano)')
  console.log('- USD: Dólar Estadounidense')
  console.log('\nPara actualizar el tipo de cambio USD/CUP, ve a Configuración → Monedas')
}

main()
  .catch((error) => {
    console.error('❌ Error en inicialización:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })