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

  // Table Carts (cafeteria mode)
  tableCarts: Record<number, CartItem[]>;
  getTableCart: (tableNum: number) => CartItem[];
  getTableTotal: (tableNum: number) => number;

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
    const { cart, posType, selectedTable, tableCarts } = get();
    const existing = cart.find(
      (i) => i.productId === item.productId && i.warehouseId === item.warehouseId
    );
    let updatedCart: CartItem[];
    if (existing) {
      const newQty = existing.quantity + item.quantity;
      if (newQty > item.stock) return; // No superar stock
      updatedCart = cart.map((i) =>
        i.productId === item.productId && i.warehouseId === item.warehouseId
          ? {
              ...i,
              quantity: newQty,
              subtotal: newQty * i.salePrice,
              costSubtotal: newQty * i.costPrice,
            }
          : i
      );
    } else {
      updatedCart = [...cart, item];
    }
    // Sync to tableCarts in cafeteria mode
    if (posType === 'cafeteria' && selectedTable !== null) {
      set({
        cart: updatedCart,
        tableCarts: { ...tableCarts, [selectedTable]: updatedCart },
      });
    } else {
      set({ cart: updatedCart });
    }
  },
  removeFromCart: (productId) => {
    const { cart, posType, selectedTable, tableCarts } = get();
    const updatedCart = cart.filter((i) => i.productId !== productId);
    if (posType === 'cafeteria' && selectedTable !== null) {
      set({
        cart: updatedCart,
        tableCarts: { ...tableCarts, [selectedTable]: updatedCart },
      });
    } else {
      set({ cart: updatedCart });
    }
  },
  updateCartItemQuantity: (productId, quantity) => {
    const { cart, posType, selectedTable, tableCarts } = get();
    let updatedCart: CartItem[];
    if (quantity <= 0) {
      updatedCart = cart.filter((i) => i.productId !== productId);
    } else {
      updatedCart = cart.map((i) =>
        i.productId === productId
          ? {
              ...i,
              quantity,
              subtotal: quantity * i.salePrice,
              costSubtotal: quantity * i.costPrice,
            }
          : i
      );
    }
    if (posType === 'cafeteria' && selectedTable !== null) {
      set({
        cart: updatedCart,
        tableCarts: { ...tableCarts, [selectedTable]: updatedCart },
      });
    } else {
      set({ cart: updatedCart });
    }
  },
  clearCart: () => {
    const { posType, selectedTable, tableCarts } = get();
    if (posType === 'cafeteria' && selectedTable !== null) {
      const newTableCarts = { ...tableCarts };
      delete newTableCarts[selectedTable];
      set({ cart: [], selectedPaymentMethod: 'EFECTIVO', tableCarts: newTableCarts });
    } else {
      set({ cart: [], selectedPaymentMethod: 'EFECTIVO' });
    }
  },
  cartSubtotal: () => get().cart.reduce((sum, i) => sum + i.subtotal, 0),
  cartCostTotal: () => get().cart.reduce((sum, i) => sum + i.costSubtotal, 0),

  // Table Carts (cafeteria mode)
  tableCarts: {},
  getTableCart: (tableNum: number) => get().tableCarts[tableNum] || [],
  getTableTotal: (tableNum: number) => (get().tableCarts[tableNum] || []).reduce((sum, i) => sum + i.subtotal, 0),

  // Payment
  selectedPaymentMethod: 'EFECTIVO',
  setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

  // POS Mode
  posType: 'kiosko',
  setPosType: (type) => {
    const { cart, selectedTable, tableCarts } = get();
    if (type === 'kiosko') {
      // Switching to kiosk: save current cafeteria cart if applicable, then reset
      const newTableCarts = { ...tableCarts };
      if (selectedTable !== null) {
        newTableCarts[selectedTable] = cart;
      }
      set({ posType: type, selectedTable: null, cart: [], tableCarts: newTableCarts });
    } else {
      set({ posType: type });
    }
  },
  posTables: 10,
  setPosTables: (count) => set({ posTables: count }),
  selectedTable: null,
  setSelectedTable: (table) => {
    const { posType, cart, selectedTable, tableCarts } = get();
    if (posType !== 'cafeteria') {
      set({ selectedTable: table });
      return;
    }

    const newTableCarts = { ...tableCarts };

    // Save current cart to previous table
    if (selectedTable !== null) {
      if (cart.length > 0) {
        newTableCarts[selectedTable] = cart;
      } else {
        delete newTableCarts[selectedTable];
      }
    }

    // Load new table's cart (or empty)
    const newCart = table !== null ? (newTableCarts[table] || []) : [];

    set({
      selectedTable: table,
      cart: newCart,
      tableCarts: newTableCarts,
      selectedPaymentMethod: 'EFECTIVO',
    });
  },

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
