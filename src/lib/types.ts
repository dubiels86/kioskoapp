export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'CUENTA_CASA';

export type CashRegisterStatus = 'ABIERTA' | 'CERRADA';

export type PurchaseStatus = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';

export type RepairStatus = 'RECIBIDO' | 'EN_REPARACION' | 'ESPERANDO_REPUESTOS' | 'REPARADO' | 'ENTREGADO' | 'CANCELADO';

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'COMPRA' | 'VENTA' | 'MERMA' | 'TRANSFERENCIA';

export type CashMovementType = 'ENTRADA' | 'SALIDA';

export type WarehouseType = 'PRINCIPAL' | 'VENTAS' | 'SECUNDARIO';

export type AppView = 'pos' | 'inventory' | 'purchases' | 'cash' | 'repairs' | 'reports';

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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CUENTA_CASA: 'Cuenta Casa / Merma',
};

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

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
  COMPRA: 'Compra',
  VENTA: 'Venta',
  MERMA: 'Merma',
  TRANSFERENCIA: 'Transferencia',
};
