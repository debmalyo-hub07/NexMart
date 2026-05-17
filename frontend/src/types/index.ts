// ── User types ────────────────────────────────────────────────
export type UserRole = 'customer' | 'admin' | 'delivery' | 'agent';
export type AuthProvider = 'email' | 'google' | 'phone';

export interface Address {
  _id?: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  emailVerified: boolean;
  phoneVerified: boolean;
  profilePicture?: string;
  gender?: string;
  dob?: string;
  addresses: Address[];
  authProviders: AuthProvider[];
  isActive: boolean;
  createdAt: string;
}

// ── Product types ─────────────────────────────────────────────
export interface ProductVariant {
  sku: string;
  attributes: Record<string, string>;
  price: number;
  comparePrice?: number;
  stock: number;
  images: string[];
}

export interface ProductCategory {
  _id: string;
  name: string;
  slug: string;
}

export interface ProductReview {
  _id: string;
  user: { name: string; profilePicture?: string };
  rating: number;
  title?: string;
  body?: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  richDescription?: string;
  category: ProductCategory;
  subCategory?: string;
  images: string[];
  videoUrl?: string;
  variants: ProductVariant[];
  tags: string[];
  brand?: string;
  specifications: Record<string, string>;
  ratings: { average: number; count: number };
  reviews: ProductReview[];
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
}

// ── Cart types ────────────────────────────────────────────────
export interface CartItem {
  _id: string;
  product: Product;
  variant: string;
  quantity: number;
  price: number;
}

export interface Cart {
  _id: string;
  items: CartItem[];
}

// ── Order types ───────────────────────────────────────────────
export type OrderStatus =
  | 'placed' | 'confirmed' | 'processing' | 'shipped'
  | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'online' | 'cod';

export interface OrderItem {
  product: Product;
  variant: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface StatusHistory {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  _id: string;
  orderId: string;
  customer: User;
  items: OrderItem[];
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: StatusHistory[];
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount: number;
  total: number;
  invoiceUrl?: string;
  deliveryId?: string;
  notes?: string;
  createdAt: string;
}

// ── API Response types ────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Dashboard types ───────────────────────────────────────────
export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  totalProducts: number;
  monthlyOrders: number;
  monthlyRevenue: number;
  pendingOrders: number;
  recentOrders: Order[];
}

// ── Category types ────────────────────────────────────────────
export interface Category {
  _id: string;
  name: string;
  slug: string;
  parent?: Category;
  image?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}
