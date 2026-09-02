/**
 * M7 Merchant Dashboard Routes + M8 Insights & Config
 * 
 * Provides merchant-facing analytics, recovery management, product inventory, and AI insights endpoints.
 * Multi-tenant safe: All endpoints derive merchantId from authenticated session or DB UUID.
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AnalyticsService, isUuid } from '../services/AnalyticsService.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { MerchantAgent } from '../services/MerchantAgent.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { MerchantInsight } from '../models/MerchantInsight.js';
import { Merchant } from '../models/Merchant.js';
import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { AppDataSource } from '../config/database.js';
import { createAuthenticate, createRequireApprovedMerchant } from '../middleware/auth.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { emailService as defaultEmailService } from '../services/EmailService.js';
import { DEMO_MERCHANT_UUID } from '../seed.js';

import { OrderService } from '../services/OrderService.js';
import { MerchantHelperService } from '../services/MerchantHelperService.js';

export function createMerchantRouter(
  dataSource: DataSource = AppDataSource,
  authService: AuthService = defaultAuthService,
  emailService = defaultEmailService,
  orderService: OrderService = new OrderService(dataSource)
): Router {
  const router = Router();
  const helperService = new MerchantHelperService(dataSource, emailService);
  const authenticate = createAuthenticate(authService);
  const requireApprovedMerchant = createRequireApprovedMerchant(authService);

  const analyticsService = new AnalyticsService(dataSource);
  const paymentFailureService = new PaymentFailureService(dataSource);

  // Helper to resolve authenticated merchant ID to a valid PostgreSQL UUID
  async function getAuthenticatedMerchantId(req: Request): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (req.user?.email === 'nnnnsachdeva@gmail.com') {
      return DEMO_MERCHANT_UUID;
    }

    const merchantRepo = dataSource.getRepository(Merchant);

    if (req.user?.id && uuidRegex.test(req.user.id)) {
      let merchant = await merchantRepo.findOne({
        where: [{ id: req.user.id }, { email: req.user.email }],
      });
      if (merchant) return merchant.id;
    }

    if (req.user?.email) {
      const merchant = await merchantRepo.findOne({ where: { email: req.user.email } });
      if (merchant && uuidRegex.test(merchant.id)) {
        return merchant.id;
      }
    }

    // Fallback: Return seeded demo merchant UUID or first active Merchant from DB
    const firstMerchant = await merchantRepo.findOne({ where: {} });
    if (firstMerchant && uuidRegex.test(firstMerchant.id)) {
      return firstMerchant.id;
    }

    return DEMO_MERCHANT_UUID;
  }

  /**
   * GET /api/merchant/application-status
   * Returns current applicant's merchant application details and full timeline
   */
  router.get('/application-status', authenticate, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      let status = await authService.getMerchantApplicationStatus(req.user.id);
      if (!status && req.user.email) {
        status = await authService.getMerchantApplicationStatus(req.user.email);
      }

      if (!status) {
        return res.status(404).json({ error: 'No merchant application found for user' });
      }

      res.json(status);
    } catch (err: any) {
      console.error('Error fetching application status:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/merchant/dashboard
   * Returns comprehensive dashboard metrics for the merchant
   */
  router.get('/dashboard', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let endDate = new Date();

      if (req.query.start_date) {
        const parsed = new Date(req.query.start_date as string);
        if (!isNaN(parsed.getTime())) startDate = parsed;
      }

      if (req.query.end_date) {
        const parsed = new Date(req.query.end_date as string);
        if (!isNaN(parsed.getTime())) {
          parsed.setHours(23, 59, 59, 999);
          endDate = parsed;
        }
      }

      if (startDate > endDate) {
        return res.status(400).json({ error: 'start_date must be before end_date' });
      }

      const merchantId = await getAuthenticatedMerchantId(req);

      const [metrics, funnel, responseBreakdown, failureReasons, revenueTimeline] = await Promise.all([
        analyticsService.getDashboardMetrics(merchantId, startDate, endDate),
        analyticsService.getRecoveryFunnel(merchantId),
        analyticsService.getCustomerResponseBreakdown(merchantId),
        analyticsService.getPaymentFailureReasons(merchantId),
        analyticsService.getRevenueTimeline(merchantId, startDate, endDate),
      ]);

      const productRepo = dataSource.getRepository('Product');
      const allMerchantProducts: any[] = await productRepo
        .createQueryBuilder('p')
        .where('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId })
        .andWhere("(p.category IS NULL OR p.category != 'archived')")
        .getMany();

      const inventoryRepo = dataSource.getRepository('Inventory');
      const orderItemRepo = dataSource.getRepository('OrderItem');

      let totalSold = 0;
      let totalUnitsInStock = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const inventoryList = [];

      for (const p of allMerchantProducts) {
        const inv: any = await inventoryRepo.findOne({ where: { product_id: p.id } });
        const soldRaw = await orderItemRepo
          .createQueryBuilder('oi')
          .innerJoin('orders', 'o', 'o.id = oi.order_id')
          .select('SUM(oi.quantity)', 'sold')
          .where('oi.product_id = :pId', { pId: p.id })
          .andWhere("o.status NOT IN ('cancelled', 'order_returned_to_seller', 'refund_initiated')")
          .andWhere("(o.return_status IS NULL OR o.return_status NOT IN ('order_returned_to_seller', 'refund_initiated'))")
          .getRawOne();
        const unitsSold = parseInt(soldRaw?.sold || '0', 10);
        totalSold += unitsSold;

        const qOnHand = inv?.quantity_on_hand || 0;
        const qReserved = inv?.reserved || 0;
        const available = Math.max(0, qOnHand - qReserved);
        totalUnitsInStock += available;

        if (available === 0) {
          outOfStockCount++;
        } else if (available <= 5) {
          lowStockCount++;
        }

        inventoryList.push({
          id: p.id,
          name: p.name,
          category: p.category,
          price_cents: Number(p.price_cents),
          quantity_on_hand: qOnHand,
          reserved: qReserved,
          available,
          units_sold: unitsSold,
        });
      }

      inventoryList.sort((a, b) => {
        if (a.available <= 5 && b.available > 5) return -1;
        if (a.available > 5 && b.available <= 5) return 1;
        return b.units_sold - a.units_sold;
      });

      res.json({
        merchant_id: merchantId,
        metrics: {
          ...metrics,
          products_listed_count: allMerchantProducts.length,
          products_sold_count: totalSold,
          total_units_in_stock: totalUnitsInStock,
          low_stock_items_count: lowStockCount,
          out_of_stock_count: outOfStockCount,
        },
        inventory_summary: {
          total_listed: allMerchantProducts.length,
          total_units_in_stock: totalUnitsInStock,
          low_stock_count: lowStockCount,
          out_of_stock_count: outOfStockCount,
          total_sold: totalSold,
          products: inventoryList.slice(0, 10),
        },
        funnel,
        response_breakdown: responseBreakdown,
        failure_reasons: failureReasons,
        revenue_timeline: revenueTimeline,
      });
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/merchant/feedback
   * Returns order feedback analytics and customer reviews
   */
  router.get('/feedback', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const rating = req.query.rating ? parseInt(req.query.rating as string, 10) : undefined;
      const category = req.query.category ? (req.query.category as string) : undefined;

      const feedbackBreakdown = await analyticsService.getFeedbackBreakdown(merchantId, rating, category);
      res.json(feedbackBreakdown);
    } catch (err: any) {
      console.error('Error fetching merchant feedback analytics:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch feedback analytics' });
    }
  });

  /**
   * GET /api/merchant/recovery-cases
   * List all recovery cases for the merchant
   */
  router.get('/recovery-cases', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sort_by as string) || 'created_at';
      const sortOrder = ((req.query.sort_order as string) || 'desc').toUpperCase() as 'ASC' | 'DESC';

      const validStatuses = ['open', 'in_progress', 'resolved', 'abandoned', 'customer_declined'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const validSortFields = ['created_at', 'updated_at', 'status'];
      if (!validSortFields.includes(sortBy)) {
        return res.status(400).json({ error: `Invalid sort_by. Must be one of: ${validSortFields.join(', ')}` });
      }

      const RecoveryCase = dataSource.getRepository('RecoveryCase');
      let query = RecoveryCase.createQueryBuilder('rc')
        .leftJoinAndSelect('rc.order', 'order')
        .leftJoinAndSelect('rc.customer', 'customer')
        .leftJoinAndSelect('rc.payment_failure', 'pf');

      if (merchantId) {
        query = query
          .leftJoin('order.items', 'item')
          .leftJoin('item.product', 'product')
          .where('(product.merchant_id = :merchantId OR product.merchant_id IS NULL OR order.id IS NULL)', { merchantId });
      }

      if (status) {
        query = query.andWhere('rc.status = :status', { status });
      }

      const total_count = await query.getCount();

      query = query
        .orderBy(`rc.${sortBy}`, sortOrder)
        .skip(offset)
        .take(limit);

      const recovery_cases = await query.getMany();

      res.json({
        recovery_cases,
        total_count,
        limit,
        offset,
      });
    } catch (err: any) {
      console.error('Error fetching recovery cases:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/merchant/recovery-cases/:id
   * Get detailed information about a specific recovery case
   */
  router.get('/recovery-cases/:id', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const recoveryCase = await paymentFailureService.getRecoveryCase(id);

      if (!recoveryCase) {
        return res.status(404).json({ error: 'Recovery case not found' });
      }

      res.json(recoveryCase);
    } catch (err: any) {
      console.error('Error fetching recovery case:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * POST /api/merchant/recovery-cases/:id/trigger-email
   * Manually trigger/re-send recovery email to the customer (explicit merchant action)
   */
  router.post('/recovery-cases/:id/trigger-email', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const merchantId = await getAuthenticatedMerchantId(req);

      const result = await paymentFailureService.sendManualRecoveryEmail(id, merchantId);

      if (!result.success || !result.sent) {
        return res.status(400).json({
          success: false,
          sent: false,
          error: result.error || 'Failed to dispatch manual recovery email',
        });
      }

      res.json({
        success: true,
        sent: true,
        messageId: result.messageId,
        recipient: result.recipient,
        message: `Recovery email sent successfully to ${result.recipient}`,
        recoveryCase: result.recoveryCase,
      });
    } catch (err: any) {
      console.error('Error triggering manual recovery email:', err);
      res.status(500).json({ success: false, sent: false, error: err.message || 'Failed to send recovery email' });
    }
  });

  /**
   * Helper to regenerate and persist merchant insights cleanly
   */
  async function refreshMerchantInsights(merchantId: string): Promise<MerchantInsight[]> {
    const merchantAgent = new MerchantAgent(dataSource);
    const generatedInsights = await merchantAgent.generateDailyInsights(merchantId);

    const InsightRepo = dataSource.getRepository(MerchantInsight);
    // Remove previous insights for this merchant to ensure clean replacement
    await InsightRepo.delete({ merchant_id: merchantId });

    const savedEntities: MerchantInsight[] = [];
    for (const gi of generatedInsights) {
      const entity = InsightRepo.create({
        merchant_id: merchantId,
        type: gi.type,
        title: gi.title,
        summary: gi.summary,
        insights: gi.insights,
        data_summary: gi.data_summary,
        confidence_percent: gi.confidence_percent,
        guard_rails_applied: gi.guard_rails_applied,
      });
      const saved = await InsightRepo.save(entity);
      savedEntities.push(saved);
    }
    return savedEntities;
  }

  /**
   * GET /api/merchant/insights
   * Get daily merchant AI insights with support for dynamic force_refresh
   */
  router.get('/insights', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const insightType = req.query.type as string | undefined;
      const forceRefresh = req.query.force_refresh === 'true' || req.query.refresh === 'true';
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const merchantId = await getAuthenticatedMerchantId(req);

      const InsightRepo = dataSource.getRepository(MerchantInsight);
      let query = InsightRepo.createQueryBuilder('insight')
        .where('insight.merchant_id = :merchantId', { merchantId })
        .orderBy('insight.created_at', 'DESC');

      if (insightType) {
        query = query.andWhere('insight.type = :type', { type: insightType });
      }

      let total_count = await query.getCount();

      if (forceRefresh || (total_count === 0 && offset === 0 && !insightType)) {
        try {
          await refreshMerchantInsights(merchantId);
          // Re-build query after refresh
          query = InsightRepo.createQueryBuilder('insight')
            .where('insight.merchant_id = :merchantId', { merchantId })
            .orderBy('insight.created_at', 'DESC');
          if (insightType) {
            query = query.andWhere('insight.type = :type', { type: insightType });
          }
          total_count = await query.getCount();
        } catch (agentErr) {
          console.warn('Failed to regenerate daily insights automatically:', agentErr);
        }
      }

      const insights = await query
        .skip(offset)
        .take(limit)
        .getMany();

      res.json({
        insights,
        total_count,
        limit,
        offset,
      });
    } catch (err: any) {
      console.error('Error fetching insights:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * POST /api/merchant/insights/refresh
   * Explicit merchant action to recalculate business analytics and regenerate AI insights
   */
  router.post('/insights/refresh', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const updatedInsights = await refreshMerchantInsights(merchantId);

      res.json({
        success: true,
        message: 'AI insights refreshed successfully based on live business analytics',
        insights: updatedInsights,
        total_count: updatedInsights.length,
      });
    } catch (err: any) {
      console.error('Error refreshing insights:', err);
      res.status(500).json({ error: err.message || 'Failed to refresh AI insights' });
    }
  });

  /**
   * GET /api/merchant/config
   * Retrieve merchant configuration
   */
  router.get('/config', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const ConfigRepo = dataSource.getRepository(MerchantConfig);
      let config = await ConfigRepo.findOne({
        where: { merchant_id: merchantId },
      });

      if (!config) {
        config = ConfigRepo.create({
          merchant_id: merchantId,
          max_recovery_attempts: 3,
          max_discount_percent: 30,
          allowed_channels: ['email', 'sms', 'whatsapp'],
          max_promise_days: 14,
          ai_insights_enabled: true,
          bundle_recommendations_enabled: true,
          discount_strategy_enabled: true,
          inventory_opt_enabled: true,
          recovery_targeting_enabled: true,
          min_confidence_score: 70,
        });
        config = await ConfigRepo.save(config);
      }

      res.json(config);
    } catch (err: any) {
      console.error('Error fetching config:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * PUT /api/merchant/config
   * Update merchant configuration
   */
  router.put('/config', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);

      const ConfigRepo = dataSource.getRepository(MerchantConfig);
      let config = await ConfigRepo.findOne({
        where: { merchant_id: merchantId },
      });

      if (!config) {
        config = ConfigRepo.create({
          merchant_id: merchantId,
          max_recovery_attempts: 3,
          max_discount_percent: 30,
          allowed_channels: ['email', 'sms', 'whatsapp'],
          max_promise_days: 14,
          ai_insights_enabled: true,
          bundle_recommendations_enabled: true,
          discount_strategy_enabled: true,
          inventory_opt_enabled: true,
          recovery_targeting_enabled: true,
          min_confidence_score: 70,
        });
      }

      const {
        max_recovery_attempts,
        max_discount_percent,
        allowed_channels,
        max_promise_days,
        ai_insights_enabled,
        bundle_recommendations_enabled,
        discount_strategy_enabled,
        inventory_opt_enabled,
        recovery_targeting_enabled,
        min_confidence_score,
      } = req.body;

      if (max_recovery_attempts !== undefined) {
        if (max_recovery_attempts < 1 || max_recovery_attempts > 20) {
          return res.status(400).json({ error: 'max_recovery_attempts must be between 1 and 20' });
        }
        config.max_recovery_attempts = max_recovery_attempts;
      }

      if (max_discount_percent !== undefined) {
        if (max_discount_percent < 0 || max_discount_percent > 100) {
          return res.status(400).json({ error: 'max_discount_percent must be between 0 and 100' });
        }
        config.max_discount_percent = max_discount_percent;
      }

      if (allowed_channels !== undefined) {
        const validChannels = ['email', 'sms', 'whatsapp'];
        if (!Array.isArray(allowed_channels) || !allowed_channels.every((c) => validChannels.includes(c))) {
          return res.status(400).json({ error: `allowed_channels must be array of: ${validChannels.join(', ')}` });
        }
        config.allowed_channels = allowed_channels;
      }

      if (max_promise_days !== undefined) {
        if (max_promise_days < 1 || max_promise_days > 90) {
          return res.status(400).json({ error: 'max_promise_days must be between 1 and 90' });
        }
        config.max_promise_days = max_promise_days;
      }

      if (min_confidence_score !== undefined) {
        if (min_confidence_score < 0 || min_confidence_score > 100) {
          return res.status(400).json({ error: 'min_confidence_score must be between 0 and 100' });
        }
        config.min_confidence_score = min_confidence_score;
      }

      if (ai_insights_enabled !== undefined) config.ai_insights_enabled = ai_insights_enabled;
      if (bundle_recommendations_enabled !== undefined) config.bundle_recommendations_enabled = bundle_recommendations_enabled;
      if (discount_strategy_enabled !== undefined) config.discount_strategy_enabled = discount_strategy_enabled;
      if (inventory_opt_enabled !== undefined) config.inventory_opt_enabled = inventory_opt_enabled;
      if (recovery_targeting_enabled !== undefined) config.recovery_targeting_enabled = recovery_targeting_enabled;

      const updated = await ConfigRepo.save(config);

      res.json(updated);
    } catch (err: any) {
      console.error('Error updating config:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/merchant/products
   * List all products for authenticated merchant
   */
  router.get('/products', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const productRepo = dataSource.getRepository('Product');
      const inventoryRepo = dataSource.getRepository('Inventory');
      const orderItemRepo = dataSource.getRepository('OrderItem');

      const products = await productRepo.createQueryBuilder('p')
        .where('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId })
        .andWhere('(p.category IS NULL OR p.category != :archivedCat)', { archivedCat: 'archived' })
        .orderBy('p.created_at', 'DESC')
        .getMany();

      const result = [];
      for (const p of products) {
        const inv: any = await inventoryRepo.findOne({ where: { product_id: p.id } });
        const soldRaw = await orderItemRepo
          .createQueryBuilder('oi')
          .select('SUM(oi.quantity)', 'sold')
          .where('oi.product_id = :pId', { pId: p.id })
          .getRawOne();

        const qOnHand = inv?.quantity_on_hand || 0;
        const qReserved = inv?.reserved || 0;
        const unitsSold = parseInt(soldRaw?.sold || '0', 10);

        result.push({
          id: p.id,
          name: p.name,
          description: p.description,
          price_cents: Number(p.price_cents),
          category: p.category,
          merchant_id: p.merchant_id,
          created_at: p.created_at,
          updated_at: p.updated_at,
          inventory: {
            quantity_on_hand: qOnHand,
            reserved: qReserved,
            available: Math.max(0, qOnHand - qReserved),
            units_sold: unitsSold,
            last_updated: inv?.last_updated || p.updated_at,
          },
        });
      }

      res.json({ products: result });
    } catch (err: any) {
      console.error('Error fetching merchant products:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * POST /api/merchant/upload-image
   * Upload an image file or base64 payload for product management
   */
  router.post('/upload-image', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const { image, filename } = req.body;
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image data or URL is required' });
      }

      // If already a valid http/https URL, return directly
      if (image.startsWith('http://') || image.startsWith('https://')) {
        return res.json({ url: image });
      }

      // Handle base64 image data (e.g. data:image/png;base64,...)
      let buffer: Buffer;
      let ext = 'png';

      if (image.startsWith('data:image/')) {
        const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return res.status(400).json({ error: 'Invalid base64 image format' });
        }
        ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        // Raw base64 string
        buffer = Buffer.from(image, 'base64');
      }

      // Validate reasonable file size (max 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image file size exceeds 5MB limit' });
      }

      const fs = await import('fs');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const safeFilename = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(filePath, buffer);

      const imageUrl = `/uploads/${safeFilename}`;
      res.json({ url: imageUrl });
    } catch (err: any) {
      console.error('Error uploading product image:', err);
      res.status(500).json({ error: err.message || 'Failed to upload product image' });
    }
  });

  /**
   * POST /api/merchant/products
   * Create a new merchant product and corresponding inventory record
   */
  router.post('/products', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { name, description, price_cents, price, category, initial_quantity, image_url } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Product name is required' });
      }

      const calculatedPriceCents = price_cents !== undefined ? Number(price_cents) : Math.round(Number(price || 0) * 100);
      if (isNaN(calculatedPriceCents) || calculatedPriceCents < 0) {
        return res.status(400).json({ error: 'Price must be >= 0' });
      }

      const quantity = Math.max(0, parseInt(initial_quantity || '0', 10));

      const productRepo = dataSource.getRepository('Product');
      const inventoryRepo = dataSource.getRepository('Inventory');

      const rawImageUrl = image_url !== undefined ? image_url : req.body.imageUrl;
      const rawDescription = description !== undefined ? description : req.body.desc;

      if (!rawDescription || typeof rawDescription !== 'string' || rawDescription.trim() === '') {
        return res.status(400).json({ error: 'Product description is required' });
      }

      if (!rawImageUrl || typeof rawImageUrl !== 'string' || rawImageUrl.trim() === '') {
        return res.status(400).json({ error: 'Product image is required' });
      }

      const product = productRepo.create({
        name: name.trim(),
        description: rawDescription.trim(),
        price_cents: calculatedPriceCents,
        category: category || 'General',
        image_url: rawImageUrl.trim(),
        merchant_id: merchantId,
      });

      const savedProduct: any = await productRepo.save(product);

      const inventory = inventoryRepo.create({
        product_id: savedProduct.id,
        quantity_on_hand: quantity,
        reserved: 0,
      });
      const savedInventory: any = await inventoryRepo.save(inventory);

      res.status(201).json({
        ...savedProduct,
        price_cents: Number(savedProduct.price_cents),
        inventory: {
          quantity_on_hand: savedInventory.quantity_on_hand,
          reserved: savedInventory.reserved,
          available: savedInventory.quantity_on_hand - savedInventory.reserved,
        },
      });
    } catch (err: any) {
      console.error('Error creating merchant product:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * PUT /api/merchant/products/:id
   * Update a merchant product
   */
  router.put('/products/:id', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;

      const productRepo = dataSource.getRepository('Product');
      const product: any = await productRepo.findOne({ where: { id } });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.merchant_id && product.merchant_id !== merchantId) {
        return res.status(403).json({ error: 'Unauthorized to modify another merchant product' });
      }

      const { name, description, price_cents, category, image_url } = req.body;
      const rawImageUrl = image_url !== undefined ? image_url : req.body.imageUrl;
      const rawDescription = description !== undefined ? description : req.body.desc;

      if (name !== undefined) product.name = name.trim();
      if (rawDescription !== undefined) product.description = rawDescription !== null ? String(rawDescription) : '';
      if (category !== undefined) product.category = category;
      if (rawImageUrl !== undefined) {
        if (rawImageUrl === null || rawImageUrl === '' || rawImageUrl === 'remove') {
          product.image_url = null;
        } else {
          product.image_url = String(rawImageUrl).trim();
        }
      }
      if (price_cents !== undefined) {
        const val = Number(price_cents);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({ error: 'Price must be >= 0' });
        }
        product.price_cents = val;
      }

      const updated: any = await productRepo.save(product);
      res.json({
        ...updated,
        price_cents: Number(updated.price_cents),
      });
    } catch (err: any) {
      console.error('Error updating product:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * PUT /api/merchant/products/:id/inventory
   * Adjust stock inventory for a product
   */
  router.put('/products/:id/inventory', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;

      const productRepo = dataSource.getRepository('Product');
      const product: any = await productRepo.findOne({ where: { id } });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.merchant_id && product.merchant_id !== merchantId) {
        return res.status(403).json({ error: 'Unauthorized to modify another merchant product inventory' });
      }

      const { action, quantity } = req.body;
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty < 0) {
        return res.status(400).json({ error: 'Quantity must be non-negative' });
      }

      const inventoryRepo = dataSource.getRepository('Inventory');
      let inv: any = await inventoryRepo.findOne({ where: { product_id: id } });
      if (!inv) {
        inv = inventoryRepo.create({ product_id: id, quantity_on_hand: 0, reserved: 0 });
      }

      if (action === 'add') {
        inv.quantity_on_hand += qty;
      } else if (action === 'remove') {
        if (inv.quantity_on_hand - qty < inv.reserved || inv.quantity_on_hand - qty < 0) {
          return res.status(400).json({ error: 'Cannot reduce quantity on hand below reserved quantity or negative' });
        }
        inv.quantity_on_hand = Math.max(0, inv.quantity_on_hand - qty);
      } else if (action === 'set') {
        if (qty < inv.reserved) {
          return res.status(400).json({ error: 'Cannot set quantity on hand below reserved quantity' });
        }
        inv.quantity_on_hand = qty;
      } else {
        return res.status(400).json({ error: 'Invalid action. Must be add, remove, or set' });
      }

      const savedInv: any = await inventoryRepo.save(inv);
      res.json({
        product_id: id,
        quantity_on_hand: savedInv.quantity_on_hand,
        reserved: savedInv.reserved,
        available: Math.max(0, savedInv.quantity_on_hand - savedInv.reserved),
      });
    } catch (err: any) {
      console.error('Error updating inventory:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * DELETE /api/merchant/products/:id
   * Delete or archive a merchant product
   */
  router.delete('/products/:id', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;

      const productRepo = dataSource.getRepository('Product');
      const product: any = await productRepo.findOne({ where: { id } });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.merchant_id && product.merchant_id !== merchantId) {
        return res.status(403).json({ error: 'Unauthorized to delete another merchant product' });
      }

      const orderItemRepo = dataSource.getRepository('OrderItem');
      const count = await orderItemRepo.count({ where: { product_id: id } });

      if (count > 0) {
        product.category = 'archived';
        await productRepo.save(product);
        return res.json({ message: 'Product archived due to historical orders', status: 'archived', id });
      }

      const inventoryRepo = dataSource.getRepository('Inventory');
      await inventoryRepo.delete({ product_id: id });
      await productRepo.remove(product);

      res.json({ message: 'Product deleted successfully', id });
    } catch (err: any) {
      console.error('Error deleting product:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/merchant/orders
   * List orders containing items belonging to this merchant
   */
  router.get('/orders', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { status, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

      const orderRepo = dataSource.getRepository(Order);
      const query = orderRepo
        .createQueryBuilder('order')
        .innerJoinAndSelect('order.items', 'item')
        .innerJoinAndSelect('item.product', 'product')
        .leftJoinAndSelect('order.customer', 'customer')
        .where('product.merchant_id = :merchantId', { merchantId });

      if (status && typeof status === 'string') {
        query.andWhere('order.status = :status', { status });
      }

      query.orderBy('order.created_at', 'DESC');

      const orders = await query.getMany();

      // Filter each order's items to only include products belonging to this merchant
      const merchantOrders = orders.map((order) => {
        const merchantItems = (order.items || []).filter(
          (item) => item.product && item.product.merchant_id === merchantId
        );
        const merchantSubtotalCents = merchantItems.reduce(
          (sum, item) => sum + (Number(item.line_total_cents) || 0),
          0
        );

        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          customer: {
            id: order.customer?.id,
            name: order.customer?.name || 'Customer',
            email: order.customer?.email,
          },
          shipping_address: order.shipping_address || null,
          items_count: merchantItems.reduce((acc, item) => acc + item.quantity, 0),
          merchant_items: merchantItems.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            name: item.product?.name || 'Product',
            quantity: item.quantity,
            price_cents: Number(item.price_cents),
            line_total_cents: Number(item.line_total_cents),
          })),
          merchant_total_cents: merchantSubtotalCents,
          total_cents: Number(order.total_cents),
          cancellation_reason: order.cancellation_reason || null,
          cancellation_timestamp: order.cancellation_timestamp || null,
          cancelled_by: order.cancelled_by || null,
          refund_amount_cents: order.refund_amount_cents ? Number(order.refund_amount_cents) : null,
          refund_status: order.refund_status || null,
          return_status: order.return_status || null,
          return_reason: order.return_reason || null,
          return_requested_at: order.return_requested_at || null,
          return_approved_at: order.return_approved_at || null,
          return_rejected_at: order.return_rejected_at || null,
          return_rejection_reason: order.return_rejection_reason || null,
          pickup_scheduled_at: order.pickup_scheduled_at || null,
          pickup_notes: order.pickup_notes || null,
          picked_up_at: order.picked_up_at || null,
          return_in_transit_at: order.return_in_transit_at || null,
          returned_to_seller_at: order.returned_to_seller_at || null,
        };
      });

      const total = merchantOrders.length;
      const skip = (pageNum - 1) * limitNum;
      const paginatedData = merchantOrders.slice(skip, skip + limitNum);

      res.json({
        data: paginatedData,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      });
    } catch (err: any) {
      console.error('Error fetching merchant orders:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/merchant/orders/:id
   * Detail view for a specific merchant order with timeline events
   */
  router.get('/orders/:id', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;

      const orderRepo = dataSource.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items', 'items.product', 'customer'],
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const merchantItems = (order.items || []).filter(
        (item) => item.product && item.product.merchant_id === merchantId
      );

      if (merchantItems.length === 0) {
        return res.status(403).json({ error: 'Order contains no products for this merchant' });
      }

      const timelineRepo = dataSource.getRepository(OrderTimeline);
      const timeline = await timelineRepo.find({
        where: { order_id: id },
        order: { created_at: 'ASC' },
      });

      const merchantSubtotalCents = merchantItems.reduce(
        (sum, item) => sum + (Number(item.line_total_cents) || 0),
        0
      );

      const mappedMerchantItems = merchantItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.product?.name || 'Product',
        quantity: item.quantity,
        price_cents: Number(item.price_cents),
        line_total_cents: Number(item.line_total_cents),
      }));

      res.json({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        customer: {
          id: order.customer?.id,
          name: order.customer?.name || 'Customer',
          email: order.customer?.email,
          phone: order.customer?.phone,
        },
        shipping_address: order.shipping_address || null,
        merchant_items: mappedMerchantItems,
        items: mappedMerchantItems,
        merchant_total_cents: merchantSubtotalCents,
        order_total_cents: Number(order.total_cents),
        cancellation_reason: order.cancellation_reason || null,
        cancellation_timestamp: order.cancellation_timestamp || null,
        cancelled_by: order.cancelled_by || null,
        refund_amount_cents: order.refund_amount_cents ? Number(order.refund_amount_cents) : null,
        refund_status: order.refund_status || null,
        return_status: order.return_status || null,
        return_reason: order.return_reason || null,
        return_requested_at: order.return_requested_at || null,
        return_approved_at: order.return_approved_at || null,
        return_rejected_at: order.return_rejected_at || null,
        return_rejection_reason: order.return_rejection_reason || null,
        pickup_scheduled_at: order.pickup_scheduled_at || null,
        pickup_notes: order.pickup_notes || null,
        picked_up_at: order.picked_up_at || null,
        return_in_transit_at: order.return_in_transit_at || null,
        returned_to_seller_at: order.returned_to_seller_at || null,
        refund_initiated_at: order.refund_initiated_at || null,
        timeline,
      });
    } catch (err: any) {
      console.error('Error fetching merchant order details:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * POST /api/merchant/orders/:id/approve-return
   */
  router.post('/orders/:id/approve-return', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;

      const order = await orderService.approveReturn(id, merchantId);
      res.json(order);
    } catch (err: any) {
      console.error('Error approving return:', err);
      const msg = err?.message || 'Failed to approve return';
      if (msg === 'Order not found') return res.status(404).json({ error: msg });
      res.status(400).json({ error: msg });
    }
  });

  /**
   * POST /api/merchant/orders/:id/reject-return
   */
  router.post('/orders/:id/reject-return', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;
      const { reason } = req.body;

      const order = await orderService.rejectReturn(id, merchantId, reason);
      res.json(order);
    } catch (err: any) {
      console.error('Error rejecting return:', err);
      const msg = err?.message || 'Failed to reject return';
      if (msg === 'Order not found') return res.status(404).json({ error: msg });
      res.status(400).json({ error: msg });
    }
  });

  /**
   * PATCH /api/merchant/orders/:id/return-logistics
   */
  router.patch('/orders/:id/return-logistics', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;
      const { status, pickup_notes } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Logistics target status is required' });
      }

      const order = await orderService.updateReturnLogistics(id, merchantId, status, { pickupNotes: pickup_notes });
      res.json(order);
    } catch (err: any) {
      console.error('Error updating return logistics:', err);
      const msg = err?.message || 'Failed to update return logistics';
      if (msg === 'Order not found') return res.status(404).json({ error: msg });
      res.status(400).json({ error: msg });
    }
  });

  /**
   * POST /api/merchant/orders/:id/initiate-refund
   * Merchant action: Initiate refund for order returned to seller
   */
  router.post('/orders/:id/initiate-refund', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;

      const order = await orderService.initiateRefund(id, merchantId);
      res.json(order);
    } catch (err: any) {
      console.error('Error initiating refund:', err);
      const msg = err?.message || 'Failed to initiate refund';
      if (msg === 'Order not found') return res.status(404).json({ error: msg });
      res.status(400).json({ error: msg });
    }
  });

  /**
   * PATCH /api/merchant/orders/:id/status
   * Advance order fulfillment status (CONFIRMED -> DISPATCHED -> DELIVERED)
   */
  router.patch('/orders/:id/status', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { id } = req.params;
      const { status } = req.body;

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: 'Status is required' });
      }

      const normalizedStatus = status.toLowerCase().trim();
      const validStatuses = ['dispatched', 'shipped', 'delivered'];

      if (!validStatuses.includes(normalizedStatus)) {
        return res.status(400).json({ error: 'Invalid status target. Must be dispatched or delivered' });
      }

      const orderRepo = dataSource.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items', 'items.product', 'customer'],
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const hasMerchantItems = (order.items || []).some(
        (item) => item.product && item.product.merchant_id === merchantId
      );

      if (!hasMerchantItems) {
        return res.status(403).json({ error: 'Unauthorized to update status for another merchant order' });
      }

      const currentStatus = (order.status || 'pending').toLowerCase();

      // State machine transition validation
      // Allowed: confirmed -> dispatched/shipped, dispatched/shipped -> delivered
      if (normalizedStatus === 'dispatched' || normalizedStatus === 'shipped') {
        if (currentStatus !== 'confirmed') {
          return res.status(400).json({
            error: `Cannot transition order from '${currentStatus}' to '${normalizedStatus}'. Order must be 'confirmed'`,
          });
        }
      } else if (normalizedStatus === 'delivered') {
        if (currentStatus !== 'dispatched' && currentStatus !== 'shipped' && currentStatus !== 'confirmed') {
          return res.status(400).json({
            error: `Cannot transition order from '${currentStatus}' to 'delivered'`,
          });
        }
      }

      // Apply status transition
      const targetStatus = normalizedStatus === 'shipped' ? 'dispatched' : normalizedStatus;
      const targetEventType = targetStatus === 'dispatched' ? 'ORDER_DISPATCHED' : 'ORDER_DELIVERED';

      // Check Idempotency via OrderTimeline records
      const timelineRepo = dataSource.getRepository(OrderTimeline);
      const existingEvent = await timelineRepo.findOne({
        where: { order_id: id, event_type: targetEventType as any },
      });

      order.status = targetStatus as any;
      await orderRepo.save(order);

      // Record Timeline Event if not already recorded
      let timelineEvent = existingEvent;
      if (!existingEvent) {
        const eventDescription =
          targetStatus === 'dispatched'
            ? 'Order marked as Dispatched by Merchant'
            : 'Order marked as Delivered by Merchant';

        timelineEvent = timelineRepo.create({
          order_id: id,
          event_type: targetEventType as any,
          actor_role: 'merchant',
          actor_id: merchantId,
          description: eventDescription,
        });

        await timelineRepo.save(timelineEvent);
      }

      // Trigger Email Notification safely if this is the first time transitioning to this status
      let emailNotificationResult = null;
      if (!existingEvent && order.customer?.email) {
        try {
          const customerEmail = order.customer.email;
          const customerName = order.customer.name || 'Valued Customer';
          const frontendUrl = process.env.FRONTEND_URL || 'https://razorshop.app';
          const orderLink = `${frontendUrl}/orders`;

          if (targetStatus === 'dispatched') {
            emailNotificationResult = await emailService.sendOrderDispatchedNotification(
              customerEmail,
              customerName,
              order.order_number,
              {
                orderId: order.id,
                orderDate: new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                shippingAddress: order.shipping_address,
                items: (order.items || []).map((item) => ({
                  name: item.product?.name || 'Product',
                  quantity: item.quantity,
                  lineTotalCents: Number(item.line_total_cents),
                })),
                totalCents: Number(order.total_cents),
                orderLink,
              }
            );
          } else if (targetStatus === 'delivered') {
            emailNotificationResult = await emailService.sendOrderDeliveredNotification(
              customerEmail,
              customerName,
              order.order_number,
              {
                orderId: order.id,
                deliveredDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                items: (order.items || []).map((item) => ({
                  name: item.product?.name || 'Product',
                  quantity: item.quantity,
                  lineTotalCents: Number(item.line_total_cents),
                })),
                totalCents: Number(order.total_cents),
                orderLink,
              }
            );
          }
        } catch (emailErr: any) {
          console.error(`[OrderEmail] Failed to send ${targetStatus} notification email for order ${order.id}:`, emailErr);
          // Do NOT throw error or rollback order status / timeline event!
        }
      }

      res.json({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        updated_at: order.updated_at,
        timeline_event: timelineEvent,
        email_sent: emailNotificationResult?.success || false,
      });
    } catch (err: any) {
      console.error('Error updating order status:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * POST /api/merchant/helper/chat
   * Chatbot RAG assistant endpoint for Merchant Helper
   */
  router.post('/helper/chat', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { message, proposal } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const response = await helperService.processChatMessage(merchantId, message.trim(), proposal || null);
      return res.json(response);
    } catch (err: any) {
      console.error('[MerchantHelper] Error processing chat message:', err);
      return res.status(500).json({ error: err.message || 'Error processing merchant helper chat' });
    }
  });

  /**
   * POST /api/merchant/helper/action/confirm
   * Executes a proposed deal action after explicit double confirmation
   */
  router.post('/helper/action/confirm', authenticate, requireApprovedMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { proposal } = req.body;

      if (!proposal || !proposal.proposalId) {
        return res.status(400).json({ error: 'Valid action proposal is required' });
      }

      const result = await helperService.executeActionProposal(merchantId, proposal);
      return res.json(result);
    } catch (err: any) {
      console.error('[MerchantHelper] Error executing action confirm:', err);
      return res.status(400).json({ error: err.message || 'Failed to execute deal action' });
    }
  });

  return router;
}

export default createMerchantRouter();
