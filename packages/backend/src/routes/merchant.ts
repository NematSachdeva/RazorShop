/**
 * M7 Merchant Dashboard Routes + M8 Insights & Config
 * 
 * Provides merchant-facing analytics and recovery management endpoints.
 * Currently uses hardcoded 'default-merchant' context for demo.
 * 
 * Endpoints:
 * - GET /api/merchant/dashboard - Dashboard metrics overview
 * - GET /api/merchant/recovery-cases - List of recovery cases
 * - GET /api/merchant/recovery-cases/:id - Specific recovery case details
 * - GET /api/merchant/insights - Daily AI insights
 * - PUT /api/merchant/config - Update merchant configuration
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { MerchantInsight } from '../models/MerchantInsight.js';
import { Merchant } from '../models/Merchant.js';
import { AppDataSource } from '../config/database.js';
import { createAuthenticate, requireMerchant } from '../middleware/auth.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';

export function createMerchantRouter(
  dataSource: DataSource = AppDataSource,
  authService: AuthService = defaultAuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  const analyticsService = new AnalyticsService(dataSource);
  const paymentFailureService = new PaymentFailureService(dataSource);

/**
 * GET /api/merchant/dashboard
 * 
 * Returns comprehensive dashboard metrics for the merchant
 * 
 * Query parameters (optional):
 * - start_date: ISO date string (default: 30 days ago)
 * - end_date: ISO date string (default: today)
 * 
 * Response:
 * {
 *   metrics: DashboardMetrics,
 *   funnel: RecoveryFunnel,
 *   response_breakdown: CustomerResponseBreakdown,
 *   failure_reasons: PaymentFailureReasons,
 *   revenue_timeline: RevenueTimeline
 * }
 */
router.get('/dashboard', authenticate, requireMerchant, async (req: Request, res: Response) => {
  try {
    // Parse optional date range from query params
    let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let endDate = new Date();

    if (req.query.start_date) {
      const parsed = new Date(req.query.start_date as string);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed;
      }
    }

    if (req.query.end_date) {
      const parsed = new Date(req.query.end_date as string);
      if (!isNaN(parsed.getTime())) {
        endDate = parsed;
      }
    }

    // Validate date range
    if (startDate > endDate) {
      return res.status(400).json({
        error: 'start_date must be before end_date',
      });
    }

    // Resolve authenticated merchant
    let merchantId = 'default-merchant';
    if (req.user?.email) {
      const merchantRepo = dataSource.getRepository('Merchant');
      const merchant = await merchantRepo.findOne({ where: { email: req.user.email } });
      if (merchant) {
        merchantId = merchant.id;
      }
    }

    // Fetch all dashboard components in parallel
    const [metrics, funnel, responseBreakdown, failureReasons, revenueTimeline] = await Promise.all([
      analyticsService.getDashboardMetrics(merchantId),
      analyticsService.getRecoveryFunnel(merchantId),
      analyticsService.getCustomerResponseBreakdown(merchantId),
      analyticsService.getPaymentFailureReasons(merchantId),
      analyticsService.getRevenueTimeline(merchantId, startDate, endDate),
    ]);

    // Fetch Product Inventory & Sales metrics for merchant
    const productRepo = dataSource.getRepository('Product');
    const products = await productRepo.find({ take: 20 });
    const inventoryRepo = dataSource.getRepository('Inventory');
    const orderItemRepo = dataSource.getRepository('OrderItem');

    let totalSold = 0;
    const inventoryList = [];

    for (const p of products) {
      const inv = await inventoryRepo.findOne({ where: { product_id: p.id } });
      const soldRaw = await orderItemRepo
        .createQueryBuilder('oi')
        .select('SUM(oi.quantity)', 'sold')
        .where('oi.product_id = :pId', { pId: p.id })
        .getRawOne();
      const unitsSold = parseInt(soldRaw?.sold || '0', 10);
      totalSold += unitsSold;

      inventoryList.push({
        id: p.id,
        name: p.name,
        category: p.category,
        price_cents: Number(p.price_cents),
        quantity_on_hand: inv?.quantity_on_hand || 0,
        units_sold: unitsSold,
      });
    }

    res.json({
      merchant_id: merchantId,
      metrics: {
        ...metrics,
        products_listed_count: products.length,
        products_sold_count: totalSold,
      },
      inventory_summary: {
        total_listed: products.length,
        total_sold: totalSold,
        products: inventoryList,
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
 * GET /api/merchant/recovery-cases
 * 
 * List all recovery cases for the merchant with optional filtering
 * 
 * Query parameters (optional):
 * - status: Filter by recovery case status (open|in_progress|resolved|abandoned|customer_declined)
 * - limit: Number of results (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 * - sort_by: Sort field (created_at|updated_at|status) (default: created_at)
 * - sort_order: asc|desc (default: desc)
 * 
 * Response:
 * {
 *   recovery_cases: RecoveryCase[],
 *   total_count: number,
 *   limit: number,
 *   offset: number
 * }
 */
router.get('/recovery-cases', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const status = req.query.status as string | undefined;
    const limit = Math.min(
      parseInt(req.query.limit as string) || 50,
      500
    );
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sort_by as string) || 'created_at';
    const sortOrder = ((req.query.sort_order as string) || 'desc').toUpperCase() as 'ASC' | 'DESC';

    // Validate status filter
    const validStatuses = [
      'open',
      'in_progress',
      'resolved',
      'abandoned',
      'customer_declined',
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Validate sort_by
    const validSortFields = ['created_at', 'updated_at', 'status'];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        error: `Invalid sort_by. Must be one of: ${validSortFields.join(', ')}`,
      });
    }

    // Query recovery cases
    const RecoveryCase = AppDataSource.getRepository('RecoveryCase');
    let query = RecoveryCase.createQueryBuilder('rc')
      .leftJoinAndSelect('rc.order', 'order')
      .leftJoinAndSelect('rc.customer', 'customer')
      .leftJoinAndSelect('rc.payment_failure', 'pf');

    // Apply status filter
    if (status) {
      query = query.where('rc.status = :status', { status });
    }

    // Get total count
    const total_count = await query.getCount();

    // Apply sorting and pagination
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
 * 
 * Get detailed information about a specific recovery case
 * Including: order, payment failure, recovery actions, agent decisions, customer interactions
 * 
 * Response: Full RecoveryCase with all related entities
 */
router.get('/recovery-cases/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get recovery case with all related data
    const recoveryCase = await paymentFailureService.getRecoveryCase(id);

    if (!recoveryCase) {
      return res.status(404).json({
        error: 'Recovery case not found',
      });
    }

    res.json(recoveryCase);
  } catch (err: any) {
    console.error('Error fetching recovery case:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/merchant/insights
 * 
 * Get daily merchant AI insights
 * 
 * Query parameters (optional):
 * - type: Filter by insight type
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 * 
 * Response: Array of MerchantInsight
 */
router.get('/insights', authenticate, requireMerchant, async (req: Request, res: Response) => {
  try {
    const insightType = req.query.type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const merchantId = 'default-merchant'; // Demo hardcoded

    const InsightRepo = AppDataSource.getRepository(MerchantInsight);
    let query = InsightRepo.createQueryBuilder('insight')
      .where('insight.merchant_id = :merchantId', { merchantId })
      .orderBy('insight.created_at', 'DESC');

    if (insightType) {
      query = query.andWhere('insight.type = :type', { type: insightType });
    }

    const total_count = await query.getCount();

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
 * PUT /api/merchant/config
 * 
 * Update merchant configuration
 * 
 * Body: Partial MerchantConfig update
 * 
 * Response: Updated MerchantConfig
 */
router.put('/config', authenticate, requireMerchant, async (req: Request, res: Response) => {
  try {
    const merchantId = 'default-merchant'; // Demo hardcoded

    const ConfigRepo = AppDataSource.getRepository(MerchantConfig);
    let config = await ConfigRepo.findOne({
      where: { merchant_id: merchantId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'Merchant config not found',
      });
    }

    // Validate and update fields
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

    // Validate bounds
    if (max_recovery_attempts !== undefined) {
      if (max_recovery_attempts < 1 || max_recovery_attempts > 20) {
        return res.status(400).json({
          error: 'max_recovery_attempts must be between 1 and 20',
        });
      }
      config.max_recovery_attempts = max_recovery_attempts;
    }

    if (max_discount_percent !== undefined) {
      if (max_discount_percent < 0 || max_discount_percent > 100) {
        return res.status(400).json({
          error: 'max_discount_percent must be between 0 and 100',
        });
      }
      config.max_discount_percent = max_discount_percent;
    }

    if (allowed_channels !== undefined) {
      const validChannels = ['email', 'sms', 'whatsapp'];
      if (!Array.isArray(allowed_channels) || !allowed_channels.every((c) => validChannels.includes(c))) {
        return res.status(400).json({
          error: `allowed_channels must be array of: ${validChannels.join(', ')}`,
        });
      }
      config.allowed_channels = allowed_channels;
    }

    if (max_promise_days !== undefined) {
      if (max_promise_days < 1 || max_promise_days > 90) {
        return res.status(400).json({
          error: 'max_promise_days must be between 1 and 90',
        });
      }
      config.max_promise_days = max_promise_days;
    }

    if (min_confidence_score !== undefined) {
      if (min_confidence_score < 0 || min_confidence_score > 100) {
        return res.status(400).json({
          error: 'min_confidence_score must be between 0 and 100',
        });
      }
      config.min_confidence_score = min_confidence_score;
    }

    // Update boolean fields
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

  // ── Merchant Product & Inventory Management Routes ─────────────────────────

  // Helper to resolve authenticated merchant ID
  async function getAuthenticatedMerchantId(req: Request): Promise<string> {
    if (req.user?.id) {
      try {
        const merchantRepo = dataSource.getRepository(Merchant);
        let merchant = await merchantRepo.findOne({
          where: [{ id: req.user.id }, { email: req.user.email }],
        });
        if (!merchant) {
          try {
            merchant = await merchantRepo.save(
              merchantRepo.create({
                id: req.user.id,
                email: req.user.email || `merchant_${req.user.id}@test.com`,
                name: (req.user as any).name || 'Merchant Owner',
                status: 'active',
              })
            );
          } catch (createErr) {
            // Ignore if concurrently inserted or FK error
            merchant = await merchantRepo.findOne({ where: { email: req.user.email } });
          }
        }
        if (merchant) return merchant.id;
      } catch (err) {
        // Fallback to req.user.id
      }
      return req.user.id;
    }
    return 'default-merchant';
  }

  /**
   * GET /api/merchant/products
   * List all products for authenticated merchant with inventory details
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
   * Edit product details (name, description, price, category)
   */
  router.put('/products/:id', authenticate, requireMerchant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const merchantId = await getAuthenticatedMerchantId(req);
      const { name, description, price_cents, price, category } = req.body;

      const productRepo = dataSource.getRepository('Product');
      const product: any = await productRepo.findOne({ where: { id } });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.merchant_id && product.merchant_id !== merchantId) {
        return res.status(403).json({ error: 'Unauthorized to modify this product' });
      }

      if (name !== undefined) {
        if (!name || typeof name !== 'string' || name.trim() === '') {
          return res.status(400).json({ error: 'Product name cannot be empty' });
        }
        product.name = name.trim();
      }

      if (description !== undefined) {
        product.description = description;
      }

      if (price_cents !== undefined || price !== undefined) {
        const newPriceCents = price_cents !== undefined ? Number(price_cents) : Math.round(Number(price) * 100);
        if (isNaN(newPriceCents) || newPriceCents < 0) {
          return res.status(400).json({ error: 'Price must be >= 0' });
        }
        product.price_cents = newPriceCents;
      }

      if (category !== undefined) {
        product.category = category;
      }

      const savedProduct: any = await productRepo.save(product);
      res.json({
        ...savedProduct,
        price_cents: Number(savedProduct.price_cents),
      });
    } catch (err: any) {
      console.error('Error updating merchant product:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * DELETE /api/merchant/products/:id
   * Delete or archive a product safely without breaking order history
   */
  router.delete('/products/:id', authenticate, requireMerchant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const merchantId = await getAuthenticatedMerchantId(req);

      const productRepo = dataSource.getRepository('Product');
      const product: any = await productRepo.findOne({ where: { id } });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.merchant_id && product.merchant_id !== merchantId && merchantId !== 'default-merchant') {
        return res.status(403).json({ error: 'Unauthorized to delete this product' });
      }

      const orderItemRepo = dataSource.getRepository('OrderItem');
      const orderCount = await orderItemRepo.count({ where: { product_id: id } });

      if (orderCount > 0) {
        product.category = 'archived';
        await productRepo.save(product);
        return res.json({ message: 'Product archived successfully to preserve order history', status: 'archived', id });
      }

      const inventoryRepo = dataSource.getRepository('Inventory');
      const cartItemRepo = dataSource.getRepository('CartItem');
      const recRepo = dataSource.getRepository('Recommendation');

      await cartItemRepo.delete({ product_id: id });
      await recRepo.delete({ product_id: id });
      await inventoryRepo.delete({ product_id: id });
      await productRepo.remove(product);

      res.json({ message: 'Product deleted successfully', status: 'deleted', id });
    } catch (err: any) {
      console.error('Error deleting merchant product:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * PUT /api/merchant/products/:id/inventory
   * Adjust inventory stock (add, remove, or set quantity)
   */
  router.put('/products/:id/inventory', authenticate, requireMerchant, async (req: Request, res: Response) => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const { id } = req.params;
      const merchantId = await getAuthenticatedMerchantId(req);
      const { action, quantity, add_stock, remove_stock, quantity_on_hand } = req.body;

      const product: any = await qr.manager.findOne('Product', { where: { id } });
      if (!product) {
        await qr.rollbackTransaction();
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product.merchant_id && product.merchant_id !== merchantId && merchantId !== 'default-merchant') {
        await qr.rollbackTransaction();
        return res.status(403).json({ error: 'Unauthorized to modify inventory for this product' });
      }

      let inventory: any = await qr.manager
        .createQueryBuilder('Inventory', 'inv')
        .setLock('pessimistic_write')
        .where('inv.product_id = :pId', { pId: id })
        .getOne();

      if (!inventory) {
        inventory = qr.manager.create('Inventory', {
          product_id: id,
          quantity_on_hand: 0,
          reserved: 0,
        });
      }

      let newQuantity = Number(inventory.quantity_on_hand);

      if (action === 'add' || add_stock !== undefined) {
        const delta = Math.abs(Number(quantity || add_stock || 0));
        newQuantity += delta;
      } else if (action === 'remove' || remove_stock !== undefined) {
        const delta = Math.abs(Number(quantity || remove_stock || 0));
        newQuantity -= delta;
      } else if (action === 'set' || quantity_on_hand !== undefined) {
        newQuantity = Number(quantity !== undefined ? quantity : quantity_on_hand);
      } else {
        await qr.rollbackTransaction();
        return res.status(400).json({ error: 'Invalid inventory action. Specify action (add|remove|set) and quantity' });
      }

      if (isNaN(newQuantity) || newQuantity < 0) {
        await qr.rollbackTransaction();
        return res.status(400).json({ error: 'Inventory quantity cannot be negative' });
      }

      if (newQuantity < Number(inventory.reserved)) {
        await qr.rollbackTransaction();
        return res.status(400).json({ error: `Cannot reduce inventory below reserved quantity (${inventory.reserved})` });
      }

      inventory.quantity_on_hand = newQuantity;
      const updatedInventory: any = await qr.manager.save('Inventory', inventory);

      await qr.commitTransaction();

      res.json({
        product_id: id,
        quantity_on_hand: Number(updatedInventory.quantity_on_hand),
        reserved: Number(updatedInventory.reserved),
        available: Number(updatedInventory.quantity_on_hand) - Number(updatedInventory.reserved),
        last_updated: updatedInventory.last_updated,
      });
    } catch (err: any) {
      await qr.rollbackTransaction();
      console.error('Error updating inventory:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    } finally {
      await qr.release();
    }
  });

  return router;
}

export default createMerchantRouter();
