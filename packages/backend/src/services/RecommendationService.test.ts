import { RecommendationService } from './RecommendationService.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Recommendation } from '../models/Recommendation.js';
import { RecommendationEvent } from '../models/RecommendationEvent.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let testCustomerId: string;
  let testProductId1: string;
  let testProductId2: string;
  let testCartId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    service = new RecommendationService(TestDataSource);

    // Create test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `rec-test-${Date.now()}@test.com`,
      name: 'Recommendation Test User',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;

    // Create test products
    const productRepo = TestDataSource.getRepository(Product);

    const product1 = productRepo.create({
      name: 'Test Product 1',
      description: 'Test product for recommendations',
      price_cents: 50000,
      category: 'electronics',
    });
    const savedProduct1 = await productRepo.save(product1);
    testProductId1 = savedProduct1.id;

    const product2 = productRepo.create({
      name: 'Test Product 2',
      description: 'Another test product',
      price_cents: 75000,
      category: 'electronics',
    });
    const savedProduct2 = await productRepo.save(product2);
    testProductId2 = savedProduct2.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(() => {
    // Mock fetch before each test
    (global as any).fetch = jest.fn();
  });

  describe('getProductRecommendations', () => {
    beforeEach(async () => {
      // Clear recommendations first (must be done before cart/products due to foreign key constraints)
      const queryRunner = TestDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('DELETE FROM "recommendation_events"');
      await queryRunner.query('DELETE FROM "recommendations"');
      await queryRunner.release();
    });

    it('should return recommendations for existing product', async () => {
      // Mock Groq response with the actual product IDs from the database
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-groq-response',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3-70b-8192',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                products: [
                  { product_id: testProductId1, score: 0.99, reason: 'this is the source product' },
                  { product_id: testProductId2, score: 0.95, reason: 'similar category' },
                ],
                reasoning: {
                  explanation: 'Based on category similarity and purchase patterns',
                  confidence: 0.92,
                  sources: ['category_similarity', 'purchase_patterns'],
                },
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      });

      const result = await service.getProductRecommendations(testProductId1, 3);

      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].recommendation_type).toBe('product_to_product');
      expect(result.products.length).toBeGreaterThan(0);
      
      // Verify source product (testProductId1) is excluded from recommendations
      const recommendedProductIds = result.products.map(p => p.id);
      expect(recommendedProductIds).not.toContain(testProductId1);
      // Only testProductId2 should be in recommendations
      expect(recommendedProductIds).toContain(testProductId2);
    });

    it('should throw error for non-existent product', async () => {
      await expect(service.getProductRecommendations('00000000-0000-0000-0000-000000000000')).rejects.toThrow('Product not found');
    });

    it('should handle Groq API failures gracefully', async () => {
      // Mock fetch to throw an error (simulating network failure)
      (global as any).fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getProductRecommendations(testProductId1)).rejects.toThrow('AI recommendation service temporarily unavailable');
    });
  });

  describe('getCartRecommendations', () => {
    beforeEach(async () => {
      // Create a test cart
      const cartRepo = TestDataSource.getRepository(Cart);
      const cart = cartRepo.create({
        customer_id: testCustomerId,
        status: 'active',
      });
      const savedCart = await cartRepo.save(cart);
      testCartId = savedCart.id;

      // Add product to cart
      const cartItemRepo = TestDataSource.getRepository(CartItem);
      const cartItem = cartItemRepo.create({
        cart_id: testCartId,
        product_id: testProductId1,
        quantity: 1,
        price_cents: 50000,
      });
      await cartItemRepo.save(cartItem);
    });

    it('should return cart recommendations', async () => {
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-groq-cart',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3-70b-8192',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                products: [
                  { product_id: testProductId2, score: 0.85, reason: 'complements the main item' },
                ],
                reasoning: {
                  explanation: 'Based on cart analysis and purchase patterns',
                  confidence: 0.85,
                  sources: ['cart_analysis', 'purchase_patterns'],
                },
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      });

      const result = await service.getCartRecommendations(testCartId);

      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].recommendation_type).toBe('cart_cross_sell');
      expect(result.products.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent cart', async () => {
      await expect(service.getCartRecommendations('00000000-0000-0000-0000-000000000000')).rejects.toThrow('Cart not found');
    });

    it('should exclude products already in cart from recommendations', async () => {
      // Response includes the cart product which should be filtered out
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-groq-cart',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3-70b-8192',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                products: [
                  { product_id: testProductId1, score: 0.95, reason: 'already in cart' },
                  { product_id: testProductId2, score: 0.87, reason: 'complementary' },
                ],
                reasoning: {
                  explanation: 'Based on cart analysis',
                  confidence: 0.85,
                  sources: ['cart_analysis'],
                },
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      });

      const result = await service.getCartRecommendations(testCartId);

      // Verify that the product already in cart is excluded
      const productIdsInRecommendations = result.products.map(p => p.id);
      expect(productIdsInRecommendations).not.toContain(testProductId1);
      // Verify the other product is included
      expect(productIdsInRecommendations).toContain(testProductId2);
    });
  });

  describe('trackRecommendationEvent', () => {
    let testRecommendationId: string;

    beforeEach(async () => {
      // Clear all recommendations and events to ensure test isolation
      const queryRunner = TestDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('DELETE FROM "recommendation_events"');
      await queryRunner.query('DELETE FROM "recommendations"');
      await queryRunner.release();

      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-groq-response',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3-70b-8192',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                products: [{ product_id: testProductId2, score: 0.95 }],
                reasoning: { explanation: 'Based on similarity', confidence: 0.92 },
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      });

      const result = await service.getProductRecommendations(testProductId1);
      testRecommendationId = result.recommendations[0].id;
      
      // Ensure counters are reset
      const recommendationRepo = TestDataSource.getRepository(Recommendation);
      const recommendation = await recommendationRepo.findOne({ where: { id: testRecommendationId } });
      if (recommendation) {
        recommendation.shown_count = 0;
        recommendation.clicked_count = 0;
        recommendation.added_to_cart_count = 0;
        await recommendationRepo.save(recommendation);
      }
    });

    it('should track shown event', async () => {
      const event = await service.trackRecommendationEvent(testRecommendationId, 'shown');

      expect(event.id).toBeDefined();
      expect(event.recommendation_id).toBe(testRecommendationId);
      expect(event.event_type).toBe('shown');
    });

    it('should track clicked event', async () => {
      const event = await service.trackRecommendationEvent(testRecommendationId, 'clicked');

      expect(event.event_type).toBe('clicked');
    });

    it('should track added_to_cart event', async () => {
      const event = await service.trackRecommendationEvent(testRecommendationId, 'added_to_cart');

      expect(event.event_type).toBe('added_to_cart');
    });

    it('should update recommendation counters', async () => {
      await service.trackRecommendationEvent(testRecommendationId, 'shown');
      await service.trackRecommendationEvent(testRecommendationId, 'clicked');
      await service.trackRecommendationEvent(testRecommendationId, 'added_to_cart');

      const recommendation = await TestDataSource.getRepository(Recommendation)
        .findOne({ where: { id: testRecommendationId } });

      expect(recommendation?.shown_count).toBe(1);
      expect(recommendation?.clicked_count).toBe(1);
      expect(recommendation?.added_to_cart_count).toBe(1);
    });

    it('should throw error for non-existent recommendation', async () => {
      await expect(service.trackRecommendationEvent('00000000-0000-0000-0000-000000000000', 'shown')).rejects.toThrow('Recommendation not found');
    });

    it('should support optional metadata', async () => {
      const metadata = { position: 1, device_type: 'desktop' as const };
      const event = await service.trackRecommendationEvent(testRecommendationId, 'shown', metadata);

      expect(event.metadata).toEqual(metadata);
    });
  });

  describe('trackPurchaseAttribution', () => {
    let testRecommendationId: string;

    beforeEach(async () => {
      // Clear all recommendations and events to ensure test isolation
      const queryRunner = TestDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('DELETE FROM "recommendation_events"');
      await queryRunner.query('DELETE FROM "recommendations"');
      await queryRunner.release();

      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-groq-response',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3-70b-8192',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                products: [{ product_id: testProductId2, score: 0.95 }],
                reasoning: { explanation: 'Based on similarity', confidence: 0.92 },
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      });

      const result = await service.getProductRecommendations(testProductId1);
      testRecommendationId = result.recommendations[0].id;
      
      // Ensure counters are reset
      const recommendationRepo = TestDataSource.getRepository(Recommendation);
      const recommendation = await recommendationRepo.findOne({ where: { id: testRecommendationId } });
      if (recommendation) {
        recommendation.shown_count = 0;
        recommendation.clicked_count = 0;
        recommendation.added_to_cart_count = 0;
        await recommendationRepo.save(recommendation);
      }
    });

    it('should track purchase attribution', async () => {
      // Create a valid order and customer for the test
      const orderRepo = TestDataSource.getRepository(Order);
      const customerRepo = TestDataSource.getRepository(Customer);
      
      const customer = customerRepo.create({
        email: `purchase-test-${Date.now()}@test.com`,
        name: 'Purchase Test User',
        phone: '+919876543210',
      });
      const savedCustomer = await customerRepo.save(customer);
      
      const order = orderRepo.create({
        customer_id: savedCustomer.id,
        order_number: `ORD-${Date.now()}`,
        status: 'pending',
        subtotal_cents: 50000,
        tax_cents: 0,
        total_cents: 50000,
      });
      const savedOrder = await orderRepo.save(order);

      const event = await service.trackPurchaseAttribution(
        testRecommendationId,
        testProductId1,
        savedOrder.id,
        savedCustomer.id
      );

      expect(event.event_type).toBe('purchased');
      expect(event.order_id).toBe(savedOrder.id);
      expect(event.customer_id).toBe(savedCustomer.id);
    });

    it('should update recommendation counters', async () => {
      // Create a valid order and customer for the test
      const orderRepo = TestDataSource.getRepository(Order);
      const customerRepo = TestDataSource.getRepository(Customer);
      
      const customer = customerRepo.create({
        email: `purchase-test2-${Date.now()}@test.com`,
        name: 'Purchase Test User 2',
        phone: '+919876543211',
      });
      const savedCustomer = await customerRepo.save(customer);
      
      const order = orderRepo.create({
        customer_id: savedCustomer.id,
        order_number: `ORD-${Date.now()}`,
        status: 'pending',
        subtotal_cents: 50000,
        tax_cents: 0,
        total_cents: 50000,
      });
      const savedOrder = await orderRepo.save(order);

      await service.trackPurchaseAttribution(
        testRecommendationId,
        testProductId1,
        savedOrder.id,
        savedCustomer.id
      );

      const recommendation = await TestDataSource.getRepository(Recommendation)
        .findOne({ where: { id: testRecommendationId } });

      expect(recommendation?.added_to_cart_count).toBe(1);
    });
  });

  describe('getRecommendationMetrics', () => {
    let testRecommendationId: string;

    beforeEach(async () => {
      // Clear all recommendations and events to ensure test isolation
      const queryRunner = TestDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('DELETE FROM "recommendation_events"');
      await queryRunner.query('DELETE FROM "recommendations"');
      await queryRunner.release();

      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-groq-response',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama3-70b-8192',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                products: [{ product_id: testProductId2, score: 0.95 }],
                reasoning: { explanation: 'Based on similarity', confidence: 0.92 },
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      });

      const result = await service.getProductRecommendations(testProductId1);
      testRecommendationId = result.recommendations[0].id;
      
      // Ensure counters are reset for a clean test state
      const recommendationRepo = TestDataSource.getRepository(Recommendation);
      const recommendation = await recommendationRepo.findOne({ where: { id: testRecommendationId } });
      if (recommendation) {
        recommendation.shown_count = 0;
        recommendation.clicked_count = 0;
        recommendation.added_to_cart_count = 0;
        await recommendationRepo.save(recommendation);
      }
    });

    it('should return recommendation metrics', async () => {
      await service.trackRecommendationEvent(testRecommendationId, 'shown');
      await service.trackRecommendationEvent(testRecommendationId, 'shown');
      await service.trackRecommendationEvent(testRecommendationId, 'clicked');

      const metrics = await service.getRecommendationMetrics(testRecommendationId);

      expect(metrics.shown_count).toBe(2);
      expect(metrics.clicked_count).toBe(1);
      expect(metrics.added_to_cart_count).toBe(0);
      expect(metrics.purchased_count).toBe(0);
    });

    it('should calculate click rate', async () => {
      await service.trackRecommendationEvent(testRecommendationId, 'shown');
      await service.trackRecommendationEvent(testRecommendationId, 'shown');
      await service.trackRecommendationEvent(testRecommendationId, 'clicked');

      const metrics = await service.getRecommendationMetrics(testRecommendationId);

      expect(metrics.click_rate).toBe(0.5); // 1/2
    });

    it('should handle zero shown count', async () => {
      const metrics = await service.getRecommendationMetrics(testRecommendationId);

      expect(metrics.shown_count).toBe(0);
      expect(metrics.click_rate).toBe(0);
    });
  });
});
