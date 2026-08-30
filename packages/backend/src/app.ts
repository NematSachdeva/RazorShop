import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { DataSource } from 'typeorm';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import productsRoutes from './routes/products.js';
import authRoutes, { createAuthRouter } from './routes/auth.js';
import cartsRoutes from './routes/carts.js';
import { createOrdersRouter } from './routes/orders.js';
import { createPaymentsRouter } from './routes/payments.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { createRecommendationsRouter } from './routes/recommendations.js';
import recoveryRoutes from './routes/recovery.js';
import { createMerchantRouter } from './routes/merchant.js';
import { createAdminRouter } from './routes/admin.js';
import { OrderService } from './services/OrderService.js';
import { PaymentService } from './services/PaymentService.js';
import { RecommendationService } from './services/RecommendationService.js';
import { AuthService, authService as defaultAuthService } from './services/AuthService.js';
import { AppDataSource } from './config/database.js';

import addressesRoutes, { createAddressesRouter } from './routes/addresses.js';
import { AddressService } from './services/AddressService.js';

/**
 * Middleware to capture raw body for webhook signature verification
 * Razorpay webhook signature verification requires the exact raw request body
 */
function captureRawBody(req: Request, res: Response, buf: Buffer) {
  if (buf && buf.length) {
    req.body = buf.toString('utf8');
  }
}

export function createApp(
  dataSource: DataSource = AppDataSource,
  authService: AuthService = defaultAuthService
): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));

  // For Razorpay webhooks, capture raw body and parse as JSON
  // This must come before express.json() so we can access the raw body
  app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json', verify: captureRawBody }));
  
  // For all other routes, use JSON parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Create services with passed DataSource for test/production flexibility
  const orderService = new OrderService(dataSource);
  const paymentService = new PaymentService(dataSource);
  const recommendationService = new RecommendationService(dataSource);
  const addressService = new AddressService(dataSource);

  // Routes
  app.use('/api', healthRoutes);
  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/products', productsRoutes);
  app.use('/api/carts', cartsRoutes);
  app.use('/api/addresses', createAddressesRouter(addressService, authService));
  app.use('/api/recommendations', createRecommendationsRouter(recommendationService));
  app.use('/api/orders', createOrdersRouter(orderService, authService));
  app.use('/api/payments', createPaymentsRouter(paymentService));
  app.use('/api/recovery', recoveryRoutes);
  app.use('/api/merchant', createMerchantRouter(dataSource, authService));
  app.use('/api/admin', createAdminRouter(dataSource, authService));
  app.use('/api/webhooks', createWebhooksRouter(dataSource));

  // Health check at root for backwards compatibility
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
