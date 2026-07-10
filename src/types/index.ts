export type UserRole = 'owner' | 'manager' | 'cashier' | 'inventory' | 'weighing';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  outlet?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
}

export type ProductType = 'standard' | 'weight' | 'variable' | 'service';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  image?: string;
  productType: ProductType;
  sellingPrice: number;
  purchasePrice: number;
  tax: number;
  hsnCode?: string;
  unit: string;
  openingStock: number;
  minimumStock: number;
  maximumStock: number;
  reorderLevel: number;
  warehouse?: string;
  shelf?: string;
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  weight?: number;
  price: number;
  tax: number;
  discount: number;
  total: number;
  barcode: string;
  product: Product;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  gst?: string;
  rewardPoints: number;
  creditBalance: number;
  purchaseHistory: string[];
  birthday?: Date;
  membership?: {
    type: string;
    expiryDate: Date;
    discount: number;
  };
}

export interface Bill {
  _id: string;
  billNumber: string;
  customerId?: string;
  cashierId: string;
  outlet: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'split';
  paymentDetails?: any;
  status: 'pending' | 'completed' | 'voided' | 'returned';
  createdAt: Date;
  updatedAt: Date;
}

export interface Inventory {
  _id: string;
  productId: string;
  outlet: string;
  currentStock: number;
  lastUpdated: Date;
  movements: {
    type: string;
    quantity: number;
    reference?: string;
    date: Date;
  }[];
}
