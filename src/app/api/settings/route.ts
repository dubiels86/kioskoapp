import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Default settings that will be seeded if they don't exist
const DEFAULT_SETTINGS = [
  // Currency
  { key: 'currency_code', value: '"ARS"', label: 'Código de Moneda', group: 'currency' },
  { key: 'currency_symbol', value: '"$"', label: 'Símbolo de Moneda', group: 'currency' },
  { key: 'currency_locale', value: '"es-AR"', label: 'Formato de Locale', group: 'currency' },
  { key: 'currency_decimals', value: '2', label: 'Decimales', group: 'currency' },

  // Denominations - Bills
  {
    key: 'bill_denominations',
    value: JSON.stringify([10000, 2000, 1000, 500, 200, 100, 50, 20]),
    label: 'Denominaciones de Billetes',
    group: 'denominations',
  },
  // Denominations - Coins
  {
    key: 'coin_denominations',
    value: JSON.stringify([10, 5, 2, 1]),
    label: 'Denominaciones de Monedas',
    group: 'denominations',
  },

  // General
  { key: 'business_name', value: '"KioskoApp"', label: 'Nombre del Negocio', group: 'general' },
  { key: 'business_address', value: '""', label: 'Dirección', group: 'general' },
  { key: 'business_phone', value: '""', label: 'Teléfono', group: 'general' },
  { key: 'invoice_prefix', value: '"FAC"', label: 'Prefijo de Factura', group: 'general' },
  { key: 'invoice_next_number', value: '1', label: 'Próximo Número de Factura', group: 'general' },

  // POS Mode
  { key: 'pos_type', value: '"kiosko"', label: 'Tipo de POS', group: 'pos' },         // kiosko | cafetería
  { key: 'pos_tables', value: '10', label: 'Cantidad de Mesas', group: 'pos' },       // Número de mesas (solo cafetería)

  // Custom options (stored as JSON arrays)
  { key: 'custom_units', value: '[]', label: 'Unidades Personalizadas', group: 'custom_options' },
  { key: 'custom_expense_categories', value: '[]', label: 'Categorías de Gasto Personalizadas', group: 'custom_options' },
  { key: 'custom_expense_payment_methods', value: '[]', label: 'Métodos de Pago de Gastos Personalizados', group: 'custom_options' },
]

export async function GET() {
  try {
    // Ensure defaults exist
    for (const setting of DEFAULT_SETTINGS) {
      await db.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      })
    }

    const settings = await db.setting.findMany({
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    })

    // Group settings
    const grouped: Record<string, { key: string; value: string; label: string }[]> = {}
    for (const s of settings) {
      if (!grouped[s.group]) grouped[s.group] = []
      grouped[s.group].push({
        key: s.key,
        value: s.value,
        label: s.label,
      })
    }

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    // body is { key: value, ... } mapping
    const updates = Object.entries(body) as [string, string][]

    const results = []
    for (const [key, value] of updates) {
      const setting = await db.setting.findUnique({ where: { key } })
      if (setting) {
        const updated = await db.setting.update({
          where: { key },
          data: { value: typeof value === 'string' ? value : JSON.stringify(value) },
        })
        results.push(updated)
      }
    }

    return NextResponse.json({ success: true, updated: results.length })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}
