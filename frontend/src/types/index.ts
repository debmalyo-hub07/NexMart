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
  product: Product | null;
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
  name?: string;
  image?: string;
  product: Product | null;
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
  deliveryAgent?: { _id: string; name: string; phone?: string } | null;
  notes?: string;
  createdAt: string;
}

export interface CheckoutReceipt {
  orderId: string;
  humanOrderId: string;
  razorpayOrderId?: string;
  keyId?: string;
  currency: string;
  total: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  processing?: boolean;
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
/**
 * `GET /admin/analytics?days=N`. Note the differing scopes, which the UI must
 * state: `dailyRevenue` counts only orders whose payment is `paid`, while
 * `topProducts` counts item value across every order in the window.
 */
export interface AnalyticsSummary {
  dailyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: { name: string; slug?: string; totalSold: number; revenue: number }[];
  ordersByStatus: { _id: string; count: number }[];
}

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
  parent?: Category | string | null;
  image?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}

export type DeliveryStatus = 'assigned' | 'picked' | 'out_for_delivery' | 'delivered' | 'attempted' | 'returned';
export interface DeliveryAssignment {
  _id: string;
  order: Order | null;
  status: DeliveryStatus;
  assignedAt: string;
  pickedAt?: string;
  attemptedAt?: string;
  deliveredAt?: string;
}
