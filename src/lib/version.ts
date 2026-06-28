/**
 * Versión actual del sistema KioskoApp
 * 
 * Actualizar este valor con cada release.
 * Formato: MAJOR.MINOR.PATCH
 */
export const APP_VERSION = '0.4.0'

/**
 * Historial de versiones y cambios
 */
export const CHANGELOG: Record<string, string[]> = {
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
