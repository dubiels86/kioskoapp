import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/currencies/active - Get the active (base) currency with full info
export async function GET() {
  try {
    // First try to get from Currency table
    const baseCurrency = await db.currency.findFirst({
      where: { isBase: true, isActive: true },
    })

    if (baseCurrency) {
      return NextResponse.json({
        id: baseCurrency.id,
        code: baseCurrency.code,
        name: baseCurrency.name,
        symbol: baseCurrency.symbol,
        locale: baseCurrency.locale,
        isBase: baseCurrency.isBase,
        exchangeRate: baseCurrency.exchangeRate,
      })
    }

    // Fallback: try to get from settings
    const codeSetting = await db.setting.findUnique({ where: { key: 'currency_code' } })
    const symbolSetting = await db.setting.findUnique({ where: { key: 'currency_symbol' } })
    const localeSetting = await db.setting.findUnique({ where: { key: 'currency_locale' } })

    const code = codeSetting ? JSON.parse(codeSetting.value) : 'ARS'
    const symbol = symbolSetting ? JSON.parse(symbolSetting.value) : '$'
    const locale = localeSetting ? JSON.parse(localeSetting.value) : 'es-AR'

    return NextResponse.json({
      code,
      name: 'Moneda Principal',
      symbol,
      locale,
      isBase: true,
      exchangeRate: 1,
    })
  } catch (error) {
    console.error('Error fetching active currency:', error)
    return NextResponse.json({
      code: 'ARS',
      name: 'Peso Argentino',
      symbol: '$',
      locale: 'es-AR',
      isBase: true,
      exchangeRate: 1,
    })
  }
}
