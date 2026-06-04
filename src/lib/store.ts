import { create } from 'zustand';
import type { AppView, CartItem, PaymentMethod } from '@/lib/types';

export type PosType = 'kiosko' | 'cafeteria';

interface AppState {
  // Navigation
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  // POS Cart
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartSubtotal: () => number;
  cartCostTotal: () => number;

  // Payment
  selectedPaymentMethod: PaymentMethod;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;

  // POS Mode
  posType: PosType;
  setPosType: (type: PosType) => void;
  posTables: number;
  setPosTables: (count: number) => void;
  selectedTable: number | null;
  setSelectedTable: (table: number | null) => void;

  // POS Search
  posSearch: string;
  setPosSearch: (search: string) => void;
  posCategoryFilter: string;
  setPosCategoryFilter: (category: string) => void;

  // Cash Register state
  currentCashRegisterId: string | null;
  setCurrentCashRegisterId: (id: string | null) => void;

  // Warehouse
  selectedWarehouseId: string | null;
  setSelectedWarehouseId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activeView: 'pos',
  setActiveView: (view) => set({ activeView: view }),

  // Cart
  cart: [],
  addToCart: (item) => {
    const { cart } = get();
    const existing = cart.find(
      (i) => i.productId === item.productId && i.warehouseId === item.warehouseId
    );
    if (existing) {
      const newQty = existing.quantity + item.quantity;
      if (newQty > item.stock) return; // No superar stock
      set({
        cart: cart.map((i) =>
          i.productId === item.productId && i.warehouseId === item.warehouseId
            ? {
                ...i,
                quantity: newQty,
                subtotal: newQty * i.salePrice,
                costSubtotal: newQty * i.costPrice,
              }
            : i
        ),
      });
    } else {
      set({ cart: [...cart, item] });
    }
  },
  removeFromCart: (productId) =>
    set({ cart: get().cart.filter((i) => i.productId !== productId) }),
  updateCartItemQuantity: (productId, quantity) => {
    const { cart } = get();
    if (quantity <= 0) {
      set({ cart: cart.filter((i) => i.productId !== productId) });
    } else {
      set({
        cart: cart.map((i) =>
          i.productId === productId
            ? {
                ...i,
                quantity,
                subtotal: quantity * i.salePrice,
                costSubtotal: quantity * i.costPrice,
              }
            : i
        ),
      });
    }
  },
  clearCart: () =>
    set({ cart: [], selectedPaymentMethod: 'EFECTIVO' }),
  cartSubtotal: () => get().cart.reduce((sum, i) => sum + i.subtotal, 0),
  cartCostTotal: () => get().cart.reduce((sum, i) => sum + i.costSubtotal, 0),

  // Payment
  selectedPaymentMethod: 'EFECTIVO',
  setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

  // POS Mode
  posType: 'kiosko',
  setPosType: (type) => set({ posType: type, selectedTable: type === 'kiosko' ? null : get().selectedTable }),
  posTables: 10,
  setPosTables: (count) => set({ posTables: count }),
  selectedTable: null,
  setSelectedTable: (table) => set({ selectedTable: table }),

  // POS Search
  posSearch: '',
  setPosSearch: (search) => set({ posSearch: search }),
  posCategoryFilter: 'all',
  setPosCategoryFilter: (category) => set({ posCategoryFilter: category }),

  // Cash Register
  currentCashRegisterId: null,
  setCurrentCashRegisterId: (id) => set({ currentCashRegisterId: id }),

  // Warehouse
  selectedWarehouseId: null,
  setSelectedWarehouseId: (id) => set({ selectedWarehouseId: id }),
}));
