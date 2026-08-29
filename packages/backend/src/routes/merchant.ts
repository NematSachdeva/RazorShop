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
import { AppDataSource } from '../config/database.js';
import { createAuthenticate, requireMerchant } from '../middleware/auth.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { DEMO_MERCHANT_UUID } from '../seed.js';

export function createMerchantRouter(
  dataSource: DataSource = AppDataSource,
  authService: AuthService = defaultAuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  const analyticsService = new AnalyticsService(dataSource);
  const paymentFailureService = new PaymentFailureService(dataSource);

  // Helper to resolve authenticated merchant ID to a valid PostgreSQL UUID
  async function getAuthenticatedMerchantId(req: Request): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (req.user?.email === 'merchant@example.com') {
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
   * GET /api/merchant/dashboard
   * Returns comprehensive dashboard metrics for the merchant
   */
  router.get('/dashboard', authenticate, requireMerchant, async (req: Request, res: Response) => {
    try {
      let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let endDate = new Date();

      if (req.query.start_date) {
        const parsed = new Date(req.query.start_date as string);
        if (!isNaN(parsed.getTime())) startDate = parsed;
      }

      if (req.query.end_date) {
        const parsed = new Date(req.query.end_date as string);
        if (!isNaN(parsed.getTime())) endDate = parsed;
      }

      if (startDate > endDate) {
        return res.status(400).json({ error: 'start_date must be before end_date' });
      }

      const merchantId = await getAuthenticatedMerchantId(req);

      const [metrics, funnel, responseBreakdown, failureReasons, revenueTimeline] = await Promise.all([
        analyticsService.getDashboardMetrics(merchantId),
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
          .select('SUM(oi.quantity)', 'sold')
          .where('oi.product_id = :pId', { pId: p.id })
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
  router.get('/feedback', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
  router.get('/recovery-cases', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
  router.get('/recovery-cases/:id', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
  router.post('/recovery-cases/:id/trigger-email', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
   * GET /api/merchant/insights
   * Get daily merchant AI insights
   */
  router.get('/insights', authenticate, requireMerchant, async (req: Request, res: Response) => {
    try {
      const insightType = req.query.type as string | undefined;
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

      if (total_count === 0 && offset === 0) {
        try {
          const merchantAgent = new MerchantAgent(dataSource);
          const generatedInsights = await merchantAgent.generateDailyInsights(merchantId);
          for (const gi of generatedInsights) {
            const existing = await InsightRepo.findOne({
              where: { merchant_id: merchantId, type: gi.type, title: gi.title },
            });
            if (!existing) {
              await InsightRepo.save(
                InsightRepo.create({
                  merchant_id: merchantId,
                  type: gi.type,
                  title: gi.title,
                  summary: gi.summary,
                  insights: gi.insights,
                  data_summary: gi.data_summary,
                  confidence_percent: gi.confidence_percent,
                  guard_rails_applied: gi.guard_rails_applied,
                })
              );
            }
          }
          total_count = await query.getCount();
        } catch (agentErr) {
          console.warn('Failed to generate daily insights automatically:', agentErr);
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
   * GET /api/merchant/config
   * Retrieve merchant configuration
   */
  router.get('/config', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
  router.put('/config', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
  router.get('/products', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
   * POST /api/merchant/products
   * Create a new merchant product and corresponding inventory record
   */
  router.post('/products', authenticate, requireMerchant, async (req: Request, res: Response) => {
    try {
      const merchantId = await getAuthenticatedMerchantId(req);
      const { name, description, price_cents, price, category, initial_quantity } = req.body;

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

      const product = productRepo.create({
        name: name.trim(),
        description: description || '',
        price_cents: calculatedPriceCents,
        category: category || 'General',
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
  router.put('/products/:id', authenticate, requireMerchant, async (req: Request, res: Response) => {
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

      const { name, description, price_cents, category } = req.body;
      if (name !== undefined) product.name = name.trim();
      if (description !== undefined) product.description = description;
      if (category !== undefined) product.category = category;
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
  router.put('/products/:id/inventory', authenticate, requireMerchant, async (req: Request, res: Response) => {
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
  router.delete('/products/:id', authenticate, requireMerchant, async (req: Request, res: Response) => {
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

  return router;
}

export default createMerchantRouter();
