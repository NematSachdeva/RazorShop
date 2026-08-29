import { DataSource } from 'typeorm';
import { getEnv } from './env.js';
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
import { CustomerInteraction } from '../models/CustomerInteraction.js';
import { PromiseToPay } from '../models/PromiseToPay.js';
import { MerchantInsight } from '../models/MerchantInsight.js';
import { OrderFeedback } from '../models/OrderFeedback.js';

// Test database configuration - uses same schema as production
// Connects using getEnv() to ensure .env is loaded before creating DataSource
export const TestDataSource = new DataSource({
  type: 'postgres',
  url: getEnv().DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [Customer, Merchant, Product, Inventory, Cart, CartItem, Order, OrderItem, PaymentAttempt, Payment, WebhookEvent, Recommendation, RecommendationEvent, PaymentFailure, RecoveryCase, RecoveryAction, MerchantConfig, AgentDecision, AuditLog, CustomerInteraction, PromiseToPay, MerchantInsight, OrderFeedback],
  subscribers: [],
  migrations: [], // Migrations run via npm script before tests, not here
  ssl: false,
});

export async function initializeTestDatabase(): Promise<void> {
  try {
    if (!TestDataSource.isInitialized) {
      await TestDataSource.initialize();
      console.log('Test database initialized (migrations pre-applied via globalSetup)');
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
