export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'CUENTA_CASA';

export type CashRegisterStatus = 'ABIERTA' | 'CERRADA';

export type PurchaseStatus = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';

export type RepairStatus = 'RECIBIDO' | 'EN_REPARACION' | 'ESPERANDO_REPUESTOS' | 'REPARADO' | 'ENTREGADO' | 'CANCELADO';

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'COMPRA' | 'VENTA' | 'MERMA' | 'TRANSFERENCIA';

export type CashMovementType = 'ENTRADA' | 'SALIDA';

export type WarehouseType = 'PRINCIPAL' | 'VENTAS' | 'SECUNDARIO';

export type AppView = 'pos' | 'inventory' | 'purchases' | 'cash' | 'repairs' | 'reports' | 'settings';

export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  PRINCIPAL: 'Depósito Principal',
  VENTAS: 'Local de Ventas',
  SECUNDARIO: 'Secundario',
};

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  address?: string | null;
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  barcode?: string;
  image?: string | null;
  quantity: number;
  costPrice: number;
  salePrice: number;
  subtotal: number;
  costSubtotal: number;
  stock: number; // stock in the selected warehouse
  warehouseId: string;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  CUENTA_CASA: 'Cuenta Casa / Merma',
};

// Map legacy TRANSFERENCIA to TARJETA for display
export function normalizePaymentMethod(method: string): PaymentMethod {
  if (method === 'TRANSFERENCIA') return 'TARJETA'
  if (method === 'EFECTIVO' || method === 'TARJETA' || method === 'CUENTA_CASA') return method as PaymentMethod
  return 'EFECTIVO'
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  PENDIENTE: 'Pendiente',
  RECIBIDA: 'Recibida',
  CANCELADA: 'Cancelada',
};

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  RECIBIDO: 'Recibido',
  EN_REPARACION: 'En Reparación',
  ESPERANDO_REPUESTOS: 'Esperando Repuestos',
  REPARADO: 'Reparado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export type RolePermission =
  | 'pos.access'
  | 'pos.refund'
  | 'inventory.access'
  | 'inventory.manage'
  | 'purchases.access'
  | 'purchases.manage'
  | 'cash.access'
  | 'cash.open'
  | 'cash.close'
  | 'repairs.access'
  | 'repairs.manage'
  | 'reports.access'
  | 'settings.access'
  | 'settings.users'
  | 'settings.roles'
  | 'settings.all'

export const ROLE_PERMISSION_LABELS: Record<RolePermission, string> = {
  'pos.access': 'Acceso a POS',
  'pos.refund': 'Realizar devoluciones',
  'inventory.access': 'Acceso a Inventario',
  'inventory.manage': 'Gestionar inventario',
  'purchases.access': 'Acceso a Compras',
  'purchases.manage': 'Gestionar compras',
  'cash.access': 'Acceso a Caja',
  'cash.open': 'Abrir caja',
  'cash.close': 'Cerrar caja',
  'repairs.access': 'Acceso a Reparaciones',
  'repairs.manage': 'Gestionar reparaciones',
  'reports.access': 'Acceso a Reportes',
  'settings.access': 'Acceso a Ajustes',
  'settings.users': 'Gestionar usuarios',
  'settings.roles': 'Gestionar roles',
  'settings.all': 'Acceso total a ajustes',
}

export const ROLE_PERMISSION_GROUPS: { group: string; permissions: RolePermission[] }[] = [
  { group: 'Punto de Venta', permissions: ['pos.access', 'pos.refund'] },
  { group: 'Inventario', permissions: ['inventory.access', 'inventory.manage'] },
  { group: 'Compras', permissions: ['purchases.access', 'purchases.manage'] },
  { group: 'Caja', permissions: ['cash.access', 'cash.open', 'cash.close'] },
  { group: 'Reparaciones', permissions: ['repairs.access', 'repairs.manage'] },
  { group: 'Reportes', permissions: ['reports.access'] },
  { group: 'Ajustes', permissions: ['settings.access', 'settings.users', 'settings.roles', 'settings.all'] },
]

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
  COMPRA: 'Compra',
  VENTA: 'Venta',
  MERMA: 'Merma',
  TRANSFERENCIA: 'Transferencia',
};
