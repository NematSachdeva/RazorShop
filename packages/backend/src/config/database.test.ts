import { DataSource } from 'typeorm';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { Payment } from '../models/Payment.js';
import { WebhookEvent } from '../models/WebhookEvent.js';

// Test database configuration - does NOT load migrations
// This avoids TypeORM dynamic imports which fail in Jest ESM
export const TestDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [Customer, Product, Inventory, Cart, CartItem, Order, OrderItem, PaymentAttempt, Payment, WebhookEvent],
  subscribers: [],
  migrations: [], // No migrations for tests - use existing schema
  ssl: false,
});

export async function initializeTestDatabase(): Promise<void> {
  try {
    if (!TestDataSource.isInitialized) {
      await TestDataSource.initialize();
    }
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}

export async function closeTestDatabase(): Promise<void> {
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
  }
}
