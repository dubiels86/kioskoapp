export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'CUENTA_CASA';

export type CashRegisterStatus = 'ABIERTA' | 'CERRADA';

export type PurchaseStatus = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';

export type RepairStatus = 'RECIBIDO' | 'EN_REPARACION' | 'ESPERANDO_REPUESTOS' | 'REPARADO' | 'ENTREGADO' | 'CANCELADO';

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'COMPRA' | 'VENTA' | 'MERMA';

export type CashMovementType = 'ENTRADA' | 'SALIDA';

export type AppView = 'pos' | 'inventory' | 'purchases' | 'cash' | 'repairs' | 'reports';

export interface CartItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  costPrice: number;
  salePrice: number;
  subtotal: number;
  costSubtotal: number;
  stock: number;
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
};
