#!/usr/bin/env tsx
/**
 * Script para probar la API de inventario
 */

const testData = {
  productId: "cmqwjke8n0002yiuztctl9vdf",
  warehouseId: "cmqwjke8p0003yiuz9gsveqju",
  quantity: 10,
  reason: "Compra inicial de prueba",
  costPrice: 100,
  costCurrency: "CUP",
  exchangeRate: 1
}

async function testInventoryAPI() {
  console.log('🚀 Probando API de inventario...\n')
  console.log('Datos de prueba:', JSON.stringify(testData, null, 2))
  console.log('\n')

  try {
    const response = await fetch('http://localhost:3000/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()
    
    console.log(`Status: ${response.status}`)
    console.log('Respuesta:', JSON.stringify(result, null, 2))
    
    if (response.ok) {
      console.log('\n✅ API funcionando correctamente!')
    } else {
      console.log('\n❌ Error en la API:', result.error || 'Error desconocido')
    }
    
  } catch (error) {
    console.error('❌ Error conectando con la API:', error.message)
    console.log('\nAsegúrate de que el servidor de desarrollo esté corriendo:')
    console.log('npm run dev')
  }
}

testInventoryAPI()