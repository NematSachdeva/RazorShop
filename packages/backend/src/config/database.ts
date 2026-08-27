import { DataSource } from 'typeorm';
import { env } from './env.js';
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

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false, // Use migrations instead
  logging: env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  entities: [Customer, Product, Inventory, Cart, CartItem, Order, OrderItem, PaymentAttempt, Payment, WebhookEvent],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database connection initialized');
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
}
