import { DataSource } from 'typeorm';
import { env } from './env.js';
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
import { MerchantApplication } from '../models/MerchantApplication.js';
import { MerchantApplicationTimeline } from '../models/MerchantApplicationTimeline.js';
import { CustomerAddress } from '../models/CustomerAddress.js';
import { OrderTimeline } from '../models/OrderTimeline.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false, // Use migrations instead
  logging: env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  entities: [Customer, Merchant, Product, Inventory, Cart, CartItem, Order, OrderItem, PaymentAttempt, Payment, WebhookEvent, Recommendation, RecommendationEvent, PaymentFailure, RecoveryCase, RecoveryAction, MerchantConfig, AgentDecision, AuditLog, CustomerInteraction, PromiseToPay, MerchantInsight, OrderFeedback, MerchantApplication, MerchantApplicationTimeline, CustomerAddress, OrderTimeline],
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
