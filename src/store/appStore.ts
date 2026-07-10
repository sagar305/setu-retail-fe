import { create } from 'zustand';
import { User, AuthState, Product, CartItem, Customer } from '../types';

interface AppState {
  // Auth
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
  logout: () => void;

  // Billing
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateCartItem: (productId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  cartTotal: () => number;
  cartTax: () => number;

  // Customers
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;

  // UI State
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Offline storage
  offlineBills: any[];
  addOfflineBill: (bill: any) => void;
  clearOfflineBills: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  auth: {
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  },

  setAuth: (auth) => {
    set({ auth });
    localStorage.setItem('token', auth.token || '');
    localStorage.setItem('user', JSON.stringify(auth.user));
  },

  logout: () => {
    set({ auth: { token: null, user: null }, cart: [] });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  cart: [],
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity, total: (i.quantity + item.quantity) * i.price }
              : i
          ),
        };
      }
      return { cart: [...state.cart, item] };
    }),

  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((i) => i.productId !== productId),
    })),

  updateCartItem: (productId, updates) =>
    set((state) => ({
      cart: state.cart.map((i) => (i.productId === productId ? { ...i, ...updates } : i)),
    })),

  clearCart: () => set({ cart: [] }),

  cartTotal: () => {
    const state = get();
    return state.cart.reduce((sum, item) => sum + item.total, 0);
  },

  cartTax: () => {
    const state = get();
    return state.cart.reduce((sum, item) => sum + item.tax, 0);
  },

  selectedCustomer: null,
  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),

  loading: false,
  setLoading: (loading) => set({ loading }),

  error: null,
  setError: (error) => set({ error }),

  offlineBills: JSON.parse(localStorage.getItem('offlineBills') || '[]'),
  addOfflineBill: (bill) =>
    set((state) => {
      const updated = [...state.offlineBills, bill];
      localStorage.setItem('offlineBills', JSON.stringify(updated));
      return { offlineBills: updated };
    }),

  clearOfflineBills: () => {
    localStorage.setItem('offlineBills', '[]');
    set({ offlineBills: [] });
  },
}));
