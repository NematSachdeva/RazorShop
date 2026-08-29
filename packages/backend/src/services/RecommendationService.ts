import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { env } from '../config/env.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Recommendation } from '../models/Recommendation.js';
import { RecommendationEvent } from '../models/RecommendationEvent.js';
import { Order } from '../models/Order.js';

// Groq AI API response types
interface GroqMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text: string }>;
}

interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

interface RecommendationResponse {
  products: Array<{
    product_id: string;
    score: number;
    reason?: string;
  }>;
  reasoning?: {
    explanation: string;
    confidence: number;
    sources: string[];
  };
}

// Recommendation service for AI-powered recommendations using Groq
export class RecommendationService {
  private dataSource: DataSource;

  // Groq model configuration
  private static readonly MODEL = 'openai/gpt-oss-120b';
  private static readonly FALLBACK_MODEL = 'openai/gpt-oss-20b';

  // Cache TTL in milliseconds (24 hours)
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
  }

  private getRecommendationRepository() {
    return this.dataSource.getRepository(Recommendation);
  }

  private getRecommendationEventRepository() {
    return this.dataSource.getRepository(RecommendationEvent);
  }

  private getProductRepository() {
    return this.dataSource.getRepository(Product);
  }

  private getCartRepository() {
    return this.dataSource.getRepository(Cart);
  }

  private getCartItemRepository() {
    return this.dataSource.getRepository(CartItem);
  }

  private getOrderRepository() {
    return this.dataSource.getRepository(Order);
  }

  /**
   * Helper to query catalog products.
   */
  private async getRealCatalogProducts(takeCount: number = 50): Promise<Product[]> {
    let q = this.getProductRepository().createQueryBuilder('product');
    if (process.env.NODE_ENV !== 'test') {
      q = q.where("product.name NOT ILIKE :testPattern AND (product.category IS NULL OR product.category != 'test')", { testPattern: 'Test Product%' });
    }
    return await q.orderBy('product.created_at', 'DESC').take(takeCount).getMany();
  }

  // ── Product Recommendations ──────────────────────────────────────────────────

  private static CATEGORY_AFFINITIES: Record<string, string[]> = {
    'Beauty & Personal Care': ['Beauty & Personal Care', 'Clothing', 'Bags & Accessories'],
    'Technology': ['Technology', 'Electronics', 'Computers & Accessories', 'Electrical & Gadgets', 'Furniture & Office'],
    'Electronics': ['Electronics', 'Technology', 'Audio', 'Electrical & Gadgets', 'Computers & Accessories'],
    'Audio': ['Audio', 'Electronics', 'Technology', 'Mobiles & Accessories'],
    'Mobiles & Accessories': ['Mobiles & Accessories', 'Audio', 'Electronics', 'Technology'],
    'Clothing': ['Clothing', 'Footwear', 'Bags & Accessories', 'Beauty & Personal Care'],
    'Footwear': ['Footwear', 'Clothing', 'Bags & Accessories', 'Sports & Fitness'],
    'Home & Kitchen': ['Home & Kitchen', 'Furniture & Office', 'Electrical & Gadgets'],
    'Sports & Fitness': ['Sports & Fitness', 'Footwear', 'Clothing', 'Bags & Accessories'],
    'Toys & Games': ['Toys & Games', 'Books & Stationery'],
    'Books & Stationery': ['Books & Stationery', 'Furniture & Office', 'Toys & Games'],
    'Automotive': ['Automotive', 'Electrical & Gadgets', 'Technology'],
    'Pet Supplies': ['Pet Supplies', 'Home & Kitchen'],
  };

  /**
   * Get product recommendations for a specific product.
   */
  async getProductRecommendations(
    productId: string,
    limit: number = 5
  ): Promise<{ recommendations: Recommendation[]; products: Product[]; bundle?: any }> {
    const product = await this.getProductRepository().findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const now = Date.now();

    // Fetch candidate catalog filtered by category affinity
    const category = product.category || 'Technology';
    const affinityCategories = RecommendationService.CATEGORY_AFFINITIES[category] || [category];

    let catalogProducts = await this.getProductRepository()
      .createQueryBuilder('product')
      .where("product.name NOT ILIKE :testPattern AND (product.category IS NULL OR product.category != 'test')", { testPattern: 'Test Product%' })
      .andWhere('product.category IN (:...categories)', { categories: affinityCategories })
      .take(50)
      .getMany();

    if (catalogProducts.length === 0) {
      catalogProducts = await this.getRealCatalogProducts(50);
    }

    const catalogData = catalogProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || 'unknown',
      price_cents: p.price_cents,
      description: p.description?.substring(0, 200) || '',
    }));

    const prompt = this.buildProductRecommendationPrompt(
      product,
      catalogData,
      limit
    );

    let parsed: { products: Array<{ product_id: string; score: number; reason?: string }>; reason: string; reasoning?: any };
    try {
      const response = await this.callGroqAPI(prompt);
      parsed = this.parseRecommendationResponse(
        response,
        catalogProducts.map((p) => p.id),
        [productId]
      );
    } catch (err) {
      console.warn('Groq recommendation failed, using catalog fallback:', err);
      const fallbackProducts = catalogProducts
        .filter((p) => p.id !== productId)
        .slice(0, limit);
      parsed = {
        products: fallbackProducts.map((p, idx) => ({
          product_id: p.id,
          score: Math.max(0.6, 0.95 - idx * 0.05),
          reason: p.category === product.category ? 'similar_category' : 'frequently_bought_together',
        })),
        reason: 'category_similarity',
        reasoning: {
          explanation: 'Curated products based on category affinity and popularity',
          confidence: 0.85,
          sources: ['catalog_fallback'],
        },
      };
    }

    // Get recommended products
    const productIds = parsed.products.map((p) => p.product_id);
    const recommendedProducts = await this.getProductRepository().findByIds(productIds);

    // Calculate bundle deal (main product + top 2 recommended products)
    const bundleProducts = [product, ...recommendedProducts.slice(0, 2)];
    const bundle = this.calculateBundleDeal(bundleProducts, 10);

    // Store recommendation
    const recommendation = this.getRecommendationRepository().create({
      product_id: product.id,
      recommendation_type: 'product_to_product',
      reason: parsed.reason as any,
      recommended_products: parsed.products,
      reasoning: parsed.reasoning,
      metadata: {
        cache_until: new Date(now + RecommendationService.CACHE_TTL_MS).toISOString(),
        source: RecommendationService.MODEL,
        bundle,
      },
    });

    const savedRec = await this.getRecommendationRepository().save(recommendation);

    return {
      recommendations: [savedRec],
      products: recommendedProducts,
      bundle,
    };
  }

  /**
   * Calculate bundle pricing with merchant max discount guard rail.
   */
  public calculateBundleDeal(products: Product[], maxDiscountPercent: number = 10): {
    type: string;
    title: string;
    products: Array<{ id: string; name: string; price_cents: number; category: string }>;
    original_total_cents: number;
    discount_percent: number;
    discount_amount_cents: number;
    final_total_cents: number;
    savings_cents: number;
    reason: string;
  } | null {
    if (products.length < 2) return null;

    const original_total_cents = products.reduce((sum, p) => sum + Number(p.price_cents), 0);
    const discount_percent = Math.min(10, Math.max(0, maxDiscountPercent));
    const discount_amount_cents = Math.round(original_total_cents * (discount_percent / 100));
    const final_total_cents = original_total_cents - discount_amount_cents;

    return {
      type: 'bundle',
      title: 'Recommended Bundle Deal',
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price_cents: Number(p.price_cents),
        category: p.category || 'unknown',
      })),
      original_total_cents,
      discount_percent,
      discount_amount_cents,
      final_total_cents,
      savings_cents: discount_amount_cents,
      reason: 'Frequently bought together',
    };
  }

  // ── Cart Recommendations ─────────────────────────────────────────────────────

  /**
   * Get cross-sell/bundle recommendations based on current cart contents.
   */
  async getCartRecommendations(
    cartId: string
  ): Promise<{ recommendations: Recommendation[]; products: Product[]; bundle?: any }> {
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Check for cached recommendation
    const existingRecommendation = await this.getRecommendationRepository().findOne({
      where: {
        cart_id: cartId,
        recommendation_type: 'cart_cross_sell',
      },
      order: { updated_at: 'DESC' },
    });

    const now = Date.now();
    if (existingRecommendation && existingRecommendation.metadata) {
      const cacheUntil = existingRecommendation.metadata.cache_until
        ? new Date(existingRecommendation.metadata.cache_until).getTime()
        : 0;
      if (cacheUntil > now && existingRecommendation.recommended_products?.length) {
        const productIds = existingRecommendation.recommended_products.map((p) => p.product_id);
        const recommendedProducts = await this.getProductRepository().findByIds(productIds);
        return {
          recommendations: [existingRecommendation],
          products: recommendedProducts,
        };
      }
    }

    // Get cart items
    const cartItems = cart.items || [];

    if (cartItems.length === 0) {
      // No items in cart — return trending products
      return this.getTrendingRecommendations();
    }

    const cartProductIds = cartItems.map((item) => item.product_id);

    // Get products in cart
    const cartProducts = await this.getProductRepository().findByIds(cartProductIds);

    // Get catalog for recommendations
    const catalogProducts = await this.getRealCatalogProducts(50);

    const catalogData = catalogProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: (p.category || 'unknown') as string,
      price_cents: p.price_cents,
      description: (p.description?.substring(0, 200) || '') as string,
    }));

    const prompt = this.buildCartRecommendationPrompt(cartProducts, catalogData);

    let parsed: { products: Array<{ product_id: string; score: number; reason?: string }>; reason: string; reasoning?: any };
    try {
      const response = await this.callGroqAPI(prompt);
      parsed = this.parseRecommendationResponse(
        response,
        catalogProducts.map((p) => p.id),
        cartProductIds
      );
    } catch (err) {
      if (process.env.NODE_ENV === 'test') {
        throw err;
      }
      console.warn('Groq cart recommendation failed, using catalog fallback:', err);
      const fallbackProducts = catalogProducts
        .filter((p) => !cartProductIds.includes(p.id))
        .slice(0, 4);
      parsed = {
        products: fallbackProducts.map((p, idx) => ({
          product_id: p.id,
          score: Math.max(0.6, 0.9 - idx * 0.05),
          reason: 'frequently_bought_together',
        })),
        reason: 'frequently_bought_together',
        reasoning: {
          explanation: 'Complementary items commonly purchased with your cart items',
          confidence: 0.82,
          sources: ['catalog_fallback'],
        },
      };
    }

    // Get recommended products
    const productIds = parsed.products.map((p) => p.product_id);
    const recommendedProducts = await this.getProductRepository().findByIds(productIds);

    // Calculate cart bundle deal (recommended items to add to existing cart items)
    const bundle = this.calculateBundleDeal(recommendedProducts.slice(0, 2), 10);

    // Store recommendation
    const recommendation = this.getRecommendationRepository().create({
      cart_id: cartId,
      recommendation_type: 'cart_cross_sell' as any,
      reason: (parsed.reason || 'frequently_bought_together') as any,
      recommended_products: parsed.products,
      reasoning: parsed.reasoning,
      metadata: {
        cache_until: new Date(now + RecommendationService.CACHE_TTL_MS).toISOString(),
        source: RecommendationService.MODEL,
        bundle,
      },
    });

    await this.getRecommendationRepository().save(recommendation);

    return {
      recommendations: [recommendation],
      products: recommendedProducts,
      bundle,
    };
  }

  // ── Bundle Detection ─────────────────────────────────────────────────────────

  /**
   * Detect product bundles that frequently appear together.
   */
  async detectBundles(
    productId: string,
    limit: number = 3
  ): Promise<{ recommendations: Recommendation[]; products: Product[] }> {
    // For now, return product recommendations which often include bundle suggestions
    return this.getProductRecommendations(productId, limit + 2);
  }

  // ── Trending Recommendations ─────────────────────────────────────────────────

  /**
   * Get trending/popular products for首页 recommendations.
   */
  async getTrendingRecommendations(
    limit: number = 5
  ): Promise<{ recommendations: Recommendation[]; products: Product[] }> {
    const products = await this.getProductRepository().find({
      order: { created_at: 'DESC' },
      take: 20,
    });

    if (products.length === 0) {
      return { recommendations: [], products: [] };
    }

    const prompt = this.buildTrendingRecommendationPrompt(products, limit);

    const response = await this.callGroqAPI(prompt);

    const parsed = this.parseRecommendationResponse(response, products.map((p) => p.id));

    // Store as trending recommendation
    const recommendation = this.getRecommendationRepository().create({
      recommendation_type: 'home_page',
      reason: 'trending',
      recommended_products: parsed.products,
      reasoning: parsed.reasoning,
      metadata: {
        cache_until: new Date(Date.now() + RecommendationService.CACHE_TTL_MS).toISOString(),
        source: RecommendationService.MODEL,
      },
    });

    await this.getRecommendationRepository().save(recommendation);

    const productIds = parsed.products.map((p) => p.product_id);
    const recommendedProducts = await this.getProductRepository().findByIds(productIds);

    return {
      recommendations: [recommendation],
      products: recommendedProducts,
    };
  }

  // ── Event Tracking ───────────────────────────────────────────────────────────

  /**
   * Track a recommendation event.
   */
  async trackRecommendationEvent(
    recommendationId: string,
    eventType: 'shown' | 'clicked' | 'added_to_cart' | 'purchased' | 'ignored',
    metadata?: Record<string, unknown>
  ): Promise<RecommendationEvent> {
    const recommendation = await this.getRecommendationRepository().findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new Error('Recommendation not found');
    }

    // Update recommendation counters
    switch (eventType) {
      case 'shown':
        recommendation.shown_count += 1;
        break;
      case 'clicked':
        recommendation.clicked_count += 1;
        break;
      case 'added_to_cart':
        recommendation.added_to_cart_count += 1;
        break;
    }

    await this.getRecommendationRepository().save(recommendation);

    // Create event record
    const event = this.getRecommendationEventRepository().create({
      recommendation_id: recommendationId,
      event_type: eventType,
      metadata: metadata || undefined,
    });

    return await this.getRecommendationEventRepository().save(event);
  }

  /**
   * Track a purchase attribution for a recommendation.
   */
  async trackPurchaseAttribution(
    recommendationId: string,
    productId: string,
    orderId: string,
    customerId: string
  ): Promise<RecommendationEvent> {
    const recommendation = await this.getRecommendationRepository().findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new Error('Recommendation not found');
    }

    // Update counters
    recommendation.added_to_cart_count += 1;

    await this.getRecommendationRepository().save(recommendation);

    const event = this.getRecommendationEventRepository().create({
      recommendation_id: recommendationId,
      product_id: productId,
      event_type: 'purchased',
      order_id: orderId,
      customer_id: customerId,
      metadata: {
        attribution: true,
      },
    });

    return await this.getRecommendationEventRepository().save(event);
  }

  // ── Metrics ──────────────────────────────────────────────────────────────────

  /**
   * Get recommendation metrics (shown, clicked, added_to_cart, purchased counts).
   */
  async getRecommendationMetrics(recommendationId: string): Promise<{
    shown_count: number;
    clicked_count: number;
    added_to_cart_count: number;
    purchased_count: number;
    click_rate: number;
    conversion_rate: number;
  }> {
    const recommendation = await this.getRecommendationRepository().findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new Error('Recommendation not found');
    }

    const purchasedCount = await this.getRecommendationEventRepository().count({
      where: {
        recommendation_id: recommendationId,
        event_type: 'purchased',
      },
    });

    const clickedCount = await this.getRecommendationEventRepository().count({
      where: {
        recommendation_id: recommendationId,
        event_type: 'clicked',
      },
    });

    // Calculate rates
    const clickRate = recommendation.shown_count > 0
      ? clickedCount / recommendation.shown_count
      : 0;

    const conversionRate = recommendation.shown_count > 0
      ? purchasedCount / recommendation.shown_count
      : 0;

    return {
      shown_count: recommendation.shown_count,
      clicked_count: clickedCount,
      added_to_cart_count: recommendation.added_to_cart_count,
      purchased_count: purchasedCount,
      click_rate: clickRate,
      conversion_rate: conversionRate,
    };
  }

  // ── Groq AI Client ───────────────────────────────────────────────────────────

  /**
   * Call Groq AI API to generate recommendations.
   * Uses the existing GROQ_API_KEY from environment.
   * Returns deterministic fallback if Groq is unavailable.
   */
  private async callGroqAPI(prompt: string): Promise<GroqResponse> {
    if (!env.GROQ_API_KEY) {
      console.warn('GROQ_API_KEY not configured - using deterministic fallback');
      throw new Error('AI service not configured');
    }

    const modelsToTry = [RecommendationService.MODEL, RecommendationService.FALLBACK_MODEL];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful shopping assistant that recommends products in valid JSON format.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
          }),
        });

        if (response && response.ok) {
          const data = await response.json();
          return data as GroqResponse;
        }

        if (response) {
          const errorText = await response.text();
          console.warn(`Groq API model ${model} error:`, errorText);
        }
        lastError = new Error('AI recommendation service temporarily unavailable');
      } catch (err) {
        console.warn(`Failed to call Groq API model ${model}:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error('AI recommendation service temporarily unavailable');
  }

  private buildProductRecommendationPrompt(
    product: Product,
    catalog: Array<{ id: string; name: string; category: string; price_cents: number; description: string }>,
    limit: number
  ): string {
    return `You are a shopping recommendation assistant. Recommend ${limit} products similar to the given product.

Product to recommend for:
- ID: ${product.id}
- Name: ${product.name}
- Category: ${product.category}
- Price: ₹${(product.price_cents / 100).toFixed(2)}

Available catalog:
${JSON.stringify(catalog, null, 2)}

Return a JSON response with:
1. products: Array of recommended products with product_id, score (0-1), and optional reason
2. reasoning: Object with explanation, confidence (0-1), and sources

Example format:
{
  "products": [
    {"product_id": "...", "score": 0.95, "reason": "similar category and price"},
    {"product_id": "...", "score": 0.87, "reason": "frequently bought together"}
  ],
  "reasoning": {
    "explanation": "Based on category, price range, and customer behavior patterns",
    "confidence": 0.92,
    "sources": ["category_similarity", "price_range", "purchase_patterns"]
  }
}`;
  }

  private buildCartRecommendationPrompt(
    cartProducts: Product[],
    catalog: Array<{ id: string; name: string; category: string; price_cents: number; description: string }>
  ): string {
    const cartItems = cartProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price_cents: p.price_cents,
    }));

    return `You are a shopping assistant. Given the current cart, recommend complementary products or bundles.

Current cart items:
${JSON.stringify(cartItems, null, 2)}

Available catalog:
${JSON.stringify(catalog, null, 2)}

Recommend 3-5 complementary products that would go well with the cart items.

Return JSON with:
1. products: Array with product_id, score, and reason
2. reasoning: Object with explanation, confidence, sources

Example:
{
  "products": [
    {"product_id": "...", "score": 0.92, "reason": "complements the main item"},
    {"product_id": "...", "score": 0.85, "reason": "frequently purchased together"}
  ],
  "reasoning": {
    "explanation": "Based on product categories and common purchase patterns",
    "confidence": 0.88,
    "sources": ["cart_analysis", "purchase_patterns"]
  }
}`;
  }

  private buildTrendingRecommendationPrompt(
    products: Product[],
    limit: number
  ): string {
    return `You are a shopping assistant. Recommend ${limit} trending products from the catalog.

Available products:
${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, category: p.category })), null, 2)}

Return JSON with:
1. products: Array with product_id, score, reason
2. reasoning: Object with explanation, confidence, sources

Example:
{
  "products": [
    {"product_id": "...", "score": 0.95, "reason": "trending in category"},
    {"product_id": "...", "score": 0.92, "reason": "high customer rating"}
  ],
  "reasoning": {
    "explanation": "Based on popularity and trending patterns",
    "confidence": 0.90,
    "sources": ["trending_data", "customer_preferences"]
  }
}`;
  }

  private parseRecommendationResponse(
    response: GroqResponse,
    validProductIds: string[],
    excludeProductIds: string[] = []
  ): { products: RecommendationResponse['products']; reason: string; reasoning?: RecommendationResponse['reasoning'] } {
    // Extract text content from response
    let text = '';
    if (response.choices && response.choices.length > 0) {
      text = response.choices[0].message.content || '';
    }

    // Try to parse JSON
    let data: RecommendationResponse;
    try {
      data = JSON.parse(text);
    } catch {
      // Fallback: create dummy recommendation
      console.warn('Failed to parse Groq response, using fallback');
      return {
        products: [],
        reason: 'unknown',
        reasoning: {
          explanation: 'AI response could not be parsed',
          confidence: 0,
          sources: [],
        },
      };
    }

    // Validate and filter products
    const validatedProducts = (data.products || [])
      .filter(
        (p) =>
          validProductIds.includes(p.product_id) &&
          !excludeProductIds.includes(p.product_id)
      )
      .slice(0, 10); // Limit to 10 products

    return {
      products: validatedProducts,
      reason: data.reasoning?.explanation?.substring(0, 50) || 'unknown',
      reasoning: data.reasoning || {
        explanation: 'Generated by Groq AI recommendation engine',
        confidence: 0.8,
        sources: ['groq_ai'],
      },
    };
  }
}

export const recommendationService = new RecommendationService();
