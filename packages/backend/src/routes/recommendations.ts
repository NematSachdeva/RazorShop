import { Router, Request, Response } from 'express';
import { RecommendationService } from '../services/RecommendationService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Regex for UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a recommendations router with dependency-injected RecommendationService
 */
export function createRecommendationsRouter(recommendationService: RecommendationService): Router {
  const router = Router();

  // GET /api/recommendations/products/:id and /api/recommendations/products/:id/recommendations
  // Get product recommendations
  router.get(
    ['/products/:id/recommendations', '/products/:id'],
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 5;

      // Validate UUID format
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }

      // Validate limit
      if (isNaN(limit) || limit < 1 || limit > 20) {
        return res.status(400).json({ error: 'Limit must be between 1 and 20' });
      }

      try {
        const result = await recommendationService.getProductRecommendations(id, limit);

        if (result.recommendations.length === 0) {
          return res.status(404).json({ error: 'No recommendations found' });
        }

        res.status(200).json({
          product_id: id,
          bundle: result.bundle || result.recommendations[0]?.metadata?.bundle || null,
          recommendations: result.recommendations.map((rec) => ({
            id: rec.id,
            recommendation_type: rec.recommendation_type,
            reason: rec.reason,
            products: rec.recommended_products,
            reasoning: rec.reasoning,
            metrics: {
              shown_count: rec.shown_count,
              clicked_count: rec.clicked_count,
              added_to_cart_count: rec.added_to_cart_count,
            },
          })),
          products: result.products.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price_cents: p.price_cents,
            category: p.category,
            image_url: p.image_url,
          })),
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Product not found') {
            return res.status(404).json({ error: error.message });
          }
          if (error.message === 'No recommendations found') {
            return res.status(404).json({ error: error.message });
          }
          // AI service error - return empty recommendations gracefully
          if (error.message.includes('Groq API') || error.message.includes('recommendations')) {
            return res.status(200).json({
              product_id: id,
              recommendations: [],
              products: [],
              error: 'Recommendation service temporarily unavailable',
            });
          }
        }
        throw error;
      }
    })
  );

  // GET /api/recommendations/carts/:id and /api/recommendations/carts/:id/recommendations
  // Get cart recommendations (cross-sell/bundle)
  router.get(
    ['/carts/:id/recommendations', '/carts/:id'],
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      // Validate UUID format
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid cart ID format' });
      }

      try {
        const result = await recommendationService.getCartRecommendations(id);

        if (result.recommendations.length === 0) {
          return res.status(404).json({ error: 'No recommendations found' });
        }

        res.status(200).json({
          cart_id: id,
          bundle: result.bundle || result.recommendations[0]?.metadata?.bundle || null,
          recommendations: result.recommendations.map((rec) => ({
            id: rec.id,
            recommendation_type: rec.recommendation_type,
            reason: rec.reason,
            products: rec.recommended_products,
            reasoning: rec.reasoning,
            metrics: {
              shown_count: rec.shown_count,
              clicked_count: rec.clicked_count,
              added_to_cart_count: rec.added_to_cart_count,
            },
          })),
          products: result.products.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price_cents: p.price_cents,
            category: p.category,
            image_url: p.image_url,
          })),
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Cart not found') {
            return res.status(404).json({ error: error.message });
          }
          if (error.message === 'No recommendations found') {
            return res.status(404).json({ error: error.message });
          }
          // AI service error - return empty recommendations gracefully
          if (error.message.includes('Groq API') || error.message.includes('recommendations')) {
            return res.status(200).json({
              cart_id: id,
              recommendations: [],
              products: [],
              error: 'Recommendation service temporarily unavailable',
            });
          }
        }
        throw error;
      }
    })
  );

  // POST /api/recommendations/:id/events
  // Track a recommendation event (shown, clicked, added_to_cart, purchased, ignored)
  router.post(
    '/:id/events',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { event_type, metadata } = req.body;

      // Validate UUID format
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid recommendation ID format' });
      }

      // Validate event type
      const validEventTypes = ['shown', 'clicked', 'added_to_cart', 'purchased', 'ignored'];
      if (!validEventTypes.includes(event_type)) {
        return res.status(400).json({
          error: 'Invalid event type',
          validTypes: validEventTypes,
        });
      }

      try {
        const event = await recommendationService.trackRecommendationEvent(
          id,
          event_type as any,
          metadata || undefined
        );

        res.status(201).json({
          id: event.id,
          recommendation_id: event.recommendation_id,
          event_type: event.event_type,
          created_at: event.created_at,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Recommendation not found') {
            return res.status(404).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  // POST /api/recommendations/:id/purchase-attribution
  // Track purchase attribution for a recommendation
  router.post(
    '/:id/purchase-attribution',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { product_id, order_id, customer_id } = req.body;

      // Validate UUIDs
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid recommendation ID format' });
      }

      if (product_id && !UUID_REGEX.test(product_id)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }

      if (!order_id || !UUID_REGEX.test(order_id)) {
        return res.status(400).json({ error: 'Invalid or missing order ID' });
      }

      if (!customer_id || !UUID_REGEX.test(customer_id)) {
        return res.status(400).json({ error: 'Invalid or missing customer ID' });
      }

      try {
        const event = await recommendationService.trackPurchaseAttribution(
          id,
          product_id,
          order_id,
          customer_id
        );

        res.status(201).json({
          id: event.id,
          recommendation_id: event.recommendation_id,
          product_id: event.product_id,
          order_id: event.order_id,
          customer_id: event.customer_id,
          event_type: event.event_type,
          created_at: event.created_at,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Recommendation not found') {
            return res.status(404).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  // GET /api/recommendations/:id/metrics
  // Get metrics for a recommendation
  router.get(
    '/:id/metrics',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      // Validate UUID
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid recommendation ID format' });
      }

      try {
        const metrics = await recommendationService.getRecommendationMetrics(id);

        res.status(200).json({
          recommendation_id: id,
          metrics,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Recommendation not found') {
            return res.status(404).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  return router;
}

// Export default for backwards compatibility - production usage
import { recommendationService } from '../services/RecommendationService.js';
export default createRecommendationsRouter(recommendationService);
