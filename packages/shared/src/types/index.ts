// Shared types for API contracts

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp?: string;
}

export interface ErrorResponse {
  status: 'error';
  statusCode: number;
  message: string;
  stack?: string;
}

// M1 Models
export interface CustomerDTO {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProductDTO {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  original_price_cents?: number | null;
  discount_percent?: number | null;
  deal_active?: boolean;
  deal_expires_at?: string | Date | null;
  category?: string;
  image_url?: string | null;
  inventory?: {
    quantity_on_hand: number;
    reserved: number;
    available: number;
  };
  created_at: Date;
  updated_at: Date;
}

export interface InventoryDTO {
  id: string;
  product_id: string;
  quantity_on_hand: number;
  reserved: number;
  last_updated: Date;
}

// M2 Cart Models
export interface CartItemDTO {
  id: string;
  product_id: string;
  product: ProductDTO;
  quantity: number;
  price_cents: number;
  line_total_cents: number;
}

export interface CartDTO {
  id: string;
  customer_id: string;
  items: CartItemDTO[];
  subtotal_cents: number;
  discount_percent?: number;
  discount_cents?: number;
  total_cents: number;
  bundle?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ProductListResponse {
  data: ProductDTO[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// M3 Order Models
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'pickup_scheduled'
  | 'order_picked_up'
  | 'return_in_transit'
  | 'order_returned_to_seller'
  | 'refund_initiated';

export interface ShippingAddressSnapshot {
  full_address: string;
  state: string;
  pin_code: string;
  phone?: string;
  name?: string;
}

export interface OrderItemDTO {
  id: string;
  product_id: string;
  product?: ProductDTO;
  quantity: number;
  price_cents: number;
  line_total_cents: number;
  created_at: Date;
}

export interface OrderDTO {
  id: string;
  customer_id: string;
  order_number: string;
  status: OrderStatus;
  shipping_address?: ShippingAddressSnapshot | null;
  items: OrderItemDTO[];
  subtotal_cents: number;
  tax_cents: number;
  discount_cents?: number;
  total_cents: number;
  cancellation_reason?: string | null;
  cancellation_timestamp?: Date | string | null;
  cancelled_by?: 'customer' | 'merchant' | 'system' | null;
  refund_amount_cents?: number | null;
  refund_status?: string | null;
  return_status?: string | null;
  return_reason?: string | null;
  return_requested_at?: Date | string | null;
  return_approved_at?: Date | string | null;
  return_rejected_at?: Date | string | null;
  return_rejection_reason?: string | null;
  pickup_scheduled_at?: Date | string | null;
  pickup_notes?: string | null;
  picked_up_at?: Date | string | null;
  return_in_transit_at?: Date | string | null;
  returned_to_seller_at?: Date | string | null;
  refund_initiated_at?: Date | string | null;
  created_at: Date;
  updated_at: Date;
}

// M3 Payment Models
export type PaymentStatus = 'initiated' | 'pending' | 'captured' | 'failed' | 'refunded';

export interface PaymentDTO {
  id: string;
  order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  status: PaymentStatus;
  amount_cents: number;
  failure_reason?: string;
  created_at: Date;
  updated_at: Date;
}
