import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import productsRoutes from './routes/products.js';
import cartsRoutes from './routes/carts.js';
import { createOrdersRouter } from './routes/orders.js';
import { createPaymentsRouter } from './routes/payments.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { OrderService } from './services/OrderService.js';
import { PaymentService } from './services/PaymentService.js';
import { AppDataSource } from './config/database.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Create services with AppDataSource for production
  const orderService = new OrderService(AppDataSource);
  const paymentService = new PaymentService(AppDataSource);

  // Routes
  app.use('/api', healthRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/carts', cartsRoutes);
  app.use('/api/orders', createOrdersRouter(orderService));
  app.use('/api/payments', createPaymentsRouter(paymentService));
  app.use('/api/webhooks', createWebhooksRouter(AppDataSource));

  // Health check at root for backwards compatibility
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
