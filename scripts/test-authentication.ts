#!/usr/bin/env tsx
/**
 * Script para probar la autenticación de la aplicación
 */

const testData = {
  username: 'dubiel',
  password: 'openpgpwd'
}

async function testAuthentication() {
  console.log('🔐 Probando autenticación...\n')
  console.log('Usuario:', testData.username)
  console.log('Contraseña:', testData.password)
  console.log('\n')

  try {
    // 1. Probar login
    console.log('1. Probando login...')
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    })

    console.log(`   Status: ${loginRes.status}`)
    
    if (loginRes.ok) {
      const loginData = await loginRes.json()
      console.log('   ✅ Login exitoso')
      console.log('   Usuario:', loginData.user.name)
      console.log('   Rol:', loginData.user.role.name)
      
      // Obtener cookies del response
      const cookies = loginRes.headers.get('set-cookie')
      if (cookies) {
        console.log('   ✅ Cookie de sesión establecida')
      }
    } else {
      const error = await loginRes.json()
      console.log('   ❌ Error en login:', error.error || 'Error desconocido')
      return
    }

    // 2. Probar sesión (necesita cookies)
    console.log('\n2. Probando sesión...')
    const sessionRes = await fetch('http://localhost:3000/api/auth/session', {
      method: 'GET',
      credentials: 'include', // Importante: incluir cookies
    })

    console.log(`   Status: ${sessionRes.status}`)
    
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json()
      console.log('   ✅ Sesión válida')
      console.log('   Autenticado:', sessionData.authenticated)
      if (sessionData.user) {
        console.log('   Usuario:', sessionData.user.name)
      }
    } else {
      console.log('   ❌ Sesión inválida')
    }

  } catch (error) {
    console.error('❌ Error conectando con la API:', error.message)
    console.log('\nAsegúrate de que el servidor esté corriendo:')
    console.log('npm run dev')
  }
}

testAuthentication()