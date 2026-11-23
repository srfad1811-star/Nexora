export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'stripe' | 'cod' | 'bank_transfer' | 'jazzcash' | 'easypaisa';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'awaiting_verification';

export type StaffRole =
  | 'super_admin'
  | 'admin'
  | 'store_manager'
  | 'product_manager'
  | 'order_manager'
  | 'support_agent';

export type PermissionKey =
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.delete'
  | 'orders.view'
  | 'orders.manage'
  | 'orders.refund'
  | 'customers.view'
  | 'customers.manage'
  | 'inventory.manage'
  | 'marketing.manage'
  | 'cms.manage'
  | 'analytics.view'
  | 'staff.manage'
  | 'settings.manage';

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  addresses?: Address[];
  isBlocked: boolean;
  customerGroup?: 'standard' | 'vip' | 'wholesale';
  loyaltyPoints?: number;
  totalSpent?: number;
  orderCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  uid: string;
  email: string;
  name: string;
  role: StaffRole;
  permissions?: PermissionKey[];
  active: boolean;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  featured: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  color?: string;
  colorHex?: string;
  size?: string;
  sku: string;
  priceDelta?: number;
  stock: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  sku: string;
  barcode?: string;
  description?: string;
  shortDescription?: string;
  categoryId: string;
  categoryName?: string;
  subcategory?: string;
  brandId: string;
  brandName?: string;
  price: number;
  salePrice?: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold?: number;
  status: 'active' | 'draft' | 'pending' | 'scheduled' | 'archived';
  featured?: boolean;
  trending?: boolean;
  newArrival?: boolean;
  images?: string[];
  variants?: ProductVariant[];
  specifications?: ProductSpec[];
  ratingAvg?: number;
  ratingCount?: number;
  salesCount?: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  title: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  salePrice?: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
  maxStock: number;
}

export interface OrderItem {
  productId: string;
  title: string;
  sku: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  variantName?: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  note?: string;
  actorEmail?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  shippingFee?: number;
  codFee?: number;
  taxAmount?: number;
  total: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  status: OrderStatus;
  shippingAddress?: Address;
  deliveryMethod?: string;
  trackingNumber?: string;
  deliveryPartner?: string;
  notes?: string;
  internalNotes?: string;
  statusHistory?: OrderStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase?: boolean;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  minOrderAmount?: number;
  usageLimit?: number;
  usedCount?: number;
  expiresAt?: string;
  active: boolean;
  description?: string;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  amount: number;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  senderRole: 'customer' | 'staff';
  senderName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  subject: string;
  category?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productTitle?: string;
  sku: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  actorEmail?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email: string;
  phone?: string;
  leadTimeDays?: number;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  title: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface StorefrontCmsData {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroCtaLink: string;
  heroImage: string;
  promoTitle: string;
  promoDescription: string;
  promoCtaLabel: string;
  promoCtaLink: string;
  aboutStory: string;
  testimonials: Array<{
    name: string;
    role: string;
    city: string;
    quote: string;
    outcome: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  returnPolicyText: string;
  privacyPolicyText: string;
  termsText: string;
}

export interface ShippingZoneRate {
  id: string;
  zoneName: string;
  cities: string[];
  standardFee: number;
  expressFee: number;
  estimatedDays: string;
}

export interface StoreSettingsData {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  currencyCode: string;
  currencySymbol: string;
  taxRatePercent: number;
  freeShippingThreshold: number;
  codFee: number;
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankDetails: string;
  stripeEnabled: boolean;
  jazzcashEnabled: boolean;
  easypaisaEnabled: boolean;
  deliveryPartners: string[];
  shippingZones: ShippingZoneRate[];
}
