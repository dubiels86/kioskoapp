/**
 * Versión actual del sistema KioskoApp
 * 
 * Actualizar este valor con cada release.
 * Formato: MAJOR.MINOR.PATCH
 */
export const APP_VERSION = '0.7.0'

/**
 * Historial de versiones y cambios
 */
export const CHANGELOG: Record<string, string[]> = {
  '0.7.0': [
    'Pagos mixtos: reportes por método de pago correctos',
    'Dinero entregado por el cliente y cálculo de vuelto',
    'Botones de montos rápidos en efectivo',
    'Descuento visible en diálogo de cobro',
    'Recibo muestra efectivo recibido y vuelto',
    'Listado de ventas muestra desglose por método de pago',
  ],
  '0.6.0': [
    'Reportes por rango de fechas',
    'Tab de Gastos en reportes',
    'Tab de Productos más vendidos',
    'Evolución de ventas por día (modo rango)',
    'Ganancia neta (ventas - costo - gastos)',
    'Compras incluidas en reportes',
  ],
  '0.5.0': [
    'Sistema de monedas múltiples',
    'Tipos de cambio entre monedas',
    'Selector de moneda en el sidebar',
    'Historial de cambios de tipo de cambio',
    'Conversión en tiempo real al visualizar precios',
    'Moneda principal configurable',
  ],
  '0.4.0': [
    'Sistema de actualización automática',
    'Verificación de versión desde la configuración',
    'Script de actualización completo (update.sh)',
    'Script para empaquetar actualizaciones (build-update)',
    'API de verificación de versión',
  ],
  '0.3.0': [
    'Sistema de Login y Autenticación',
    'Permisos por rol en la navegación',
    'Contraseñas hasheadas con bcrypt',
    'Roles: Administrador, Vendedor, Cajero, Depósito, Super Administrador',
    'Usuario Super Admin: dubiel',
  ],
  '0.2.0': [
    'Módulo de Gastos',
    'Botón Descargar Proyecto',
    'Fix DATABASE_URL (ruta relativa)',
  ],
  '0.1.0': [
    'Versión inicial del sistema',
    'Punto de Venta (POS)',
    'Inventario',
    'Compras',
    'Caja',
    'Reparaciones',
    'Reportes',
  ],
}
