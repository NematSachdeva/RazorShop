import { DataSource } from 'typeorm';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { Payment } from '../models/Payment.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { Recommendation } from '../models/Recommendation.js';
import { RecommendationEvent } from '../models/RecommendationEvent.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { AgentDecision } from '../models/AgentDecision.js';
import { AuditLog } from '../models/AuditLog.js';

// Test database configuration - uses existing schema
// Note: This assumes the database has been migrated via `npm run db:migrate` before tests run.
// Tests use the same PostgreSQL database as production/development, with all tables already created.
export const TestDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [Customer, Merchant, Product, Inventory, Cart, CartItem, Order, OrderItem, PaymentAttempt, Payment, WebhookEvent, Recommendation, RecommendationEvent, PaymentFailure, RecoveryCase, RecoveryAction, MerchantConfig, AgentDecision, AuditLog],
  subscribers: [],
  migrations: [], // Do NOT include migrations here to avoid duplication
  ssl: false,
});

export async function initializeTestDatabase(): Promise<void> {
  try {
    if (!TestDataSource.isInitialized) {
      await TestDataSource.initialize();
      // Do NOT run migrations here. The test database should already be migrated
      // via `npm run db:migrate` script before tests start.
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
