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
  category?: string;
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
  total_cents: number;
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
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

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
  items: OrderItemDTO[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
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
