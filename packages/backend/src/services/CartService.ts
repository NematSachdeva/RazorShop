import { AppDataSource } from '../config/database.js';
import { DataSource } from 'typeorm';
import { Customer } from '../models/Customer.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Recommendation } from '../models/Recommendation.js';

export interface CartItemData {
  product_id: string;
  quantity: number;
}

export interface CartResponse {
  id: string;
  customer_id: string;
  items: CartItemResponse[];
  subtotal_cents: number;
  total_cents: number;
  created_at: Date;
  updated_at: Date;
}

export interface CartItemResponse {
  id: string;
  product_id: string;
  product: Product;
  quantity: number;
  price_cents: number;
  line_total_cents: number;
}

export class CartService {
  constructor(private dataSource: DataSource = AppDataSource) { }

  private getCartRepository() {
    return this.dataSource.getRepository(Cart);
  }

  private getCartItemRepository() {
    return this.dataSource.getRepository(CartItem);
  }

  private getProductRepository() {
    return this.dataSource.getRepository(Product);
  }

  private getInventoryRepository() {
    return this.dataSource.getRepository(Inventory);
  }

  async createCart(customerId: string): Promise<Cart> {
    const cart = this.getCartRepository().create({
      customer_id: customerId,
      status: 'active',
      items: [],
    });
    return this.getCartRepository().save(cart);
  }

  /**
   * Get or create active cart for a customer
   * If an active cart exists, return it; otherwise create a new one
   * Returns CartResponse with items loaded
   */
  async getOrCreateCart(customerId: string): Promise<CartResponse> {
    // Verify customer exists before attempting cart creation to prevent FK violation
    const customer = await this.dataSource.getRepository(Customer).findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Try to find existing active cart
    let cart = await this.getCartRepository().findOne({
      where: { customer_id: customerId, status: 'active' },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      // Create new cart
      const newCart = this.getCartRepository().create({
        customer_id: customerId,
        status: 'active',
        items: [],
      });
      cart = await this.getCartRepository().save(newCart);
    }

    return await this.cartToResponse(cart);
  }

  async getCartById(cartId: string): Promise<CartResponse | null> {
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) return null;

    return await this.cartToResponse(cart);
  }

  async addToCart(cartId: string, productId: string, quantity: number): Promise<CartResponse> {
    // Validate product exists
    const product = await this.getProductRepository().findOne({ where: { id: productId } });
    if (!product) {
      throw new Error('Product not found');
    }

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Check inventory availability
    const inventory = await this.getInventoryRepository().findOne({
      where: { product_id: productId },
    });
    if (!inventory || inventory.quantity_on_hand - inventory.reserved < quantity) {
      throw new Error('Insufficient inventory');
    }

    // Get or create cart item
    let cartItem = await this.getCartItemRepository().findOne({
      where: { cart_id: cartId, product_id: productId },
    });

    if (cartItem) {
      // Update existing item
      const newQuantity = cartItem.quantity + quantity;
      if (inventory.quantity_on_hand - inventory.reserved < newQuantity) {
        throw new Error('Insufficient inventory for requested quantity');
      }
      cartItem.quantity = newQuantity;
    } else {
      // Create new item
      cartItem = this.getCartItemRepository().create({
        cart_id: cartId,
        product_id: productId,
        quantity,
        price_cents: product.price_cents,
      });
    }

    await this.getCartItemRepository().save(cartItem);

    // Return updated cart
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) throw new Error('Cart not found');
    return await this.cartToResponse(cart);
  }

  async updateCartItemQuantity(
    cartId: string,
    productId: string,
    quantity: number
  ): Promise<CartResponse> {
    // Validate quantity
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    const cartItem = await this.getCartItemRepository().findOne({
      where: { cart_id: cartId, product_id: productId },
    });

    if (!cartItem) {
      throw new Error('Item not in cart');
    }

    // If quantity is 0, remove the item
    if (quantity === 0) {
      await this.getCartItemRepository().remove(cartItem);
    } else {
      // Check inventory availability
      const inventory = await this.getInventoryRepository().findOne({
        where: { product_id: productId },
      });
      if (!inventory || inventory.quantity_on_hand - inventory.reserved < quantity) {
        throw new Error('Insufficient inventory for requested quantity');
      }

      cartItem.quantity = quantity;
      await this.getCartItemRepository().save(cartItem);
    }

    // Return updated cart
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) throw new Error('Cart not found');
    return await this.cartToResponse(cart);
  }

  async removeFromCart(cartId: string, productId: string): Promise<CartResponse> {
    const cartItem = await this.getCartItemRepository().findOne({
      where: { cart_id: cartId, product_id: productId },
    });

    if (!cartItem) {
      throw new Error('Item not in cart');
    }

    await this.getCartItemRepository().remove(cartItem);

    // Return updated cart
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) throw new Error('Cart not found');
    return await this.cartToResponse(cart);
  }

  async clearCart(cartId: string): Promise<CartResponse> {
    await this.getCartItemRepository().delete({ cart_id: cartId });

    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) throw new Error('Cart not found');
    return await this.cartToResponse(cart);
  }

  async addBundleToCart(cartId: string, recommendationId: string): Promise<CartResponse> {
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) throw new Error('Cart not found');
    if (cart.status !== 'active') throw new Error('Cart is not active');

    // Fetch recommendation
    const recRepo = this.dataSource.getRepository(Recommendation);
    let recommendation: any = await recRepo.findOne({ where: { id: recommendationId } });

    if (!recommendation) {
      const productRepo = this.dataSource.getRepository(Product);
      const targetProduct = await productRepo.findOne({ where: { id: recommendationId } });
      if (targetProduct) {
        recommendation = await recRepo.save(
          recRepo.create({
            id: recommendationId,
            product_id: targetProduct.id,
            recommendation_type: 'cart_bundle',
            reason: 'frequently_bought_together',
            recommended_products: [{ product_id: targetProduct.id, score: 0.9 }],
            metadata: {
              bundle: {
                products: [targetProduct],
                original_total_cents: Number(targetProduct.price_cents),
                discount_percent: 10,
                savings_cents: Math.round(Number(targetProduct.price_cents) * 0.1),
                final_total_cents: Number(targetProduct.price_cents) - Math.round(Number(targetProduct.price_cents) * 0.1),
              },
            },
          })
        );
      } else {
        throw new Error('Recommendation bundle not found');
      }
    }

    const bundle = recommendation.metadata?.bundle;
    if (!bundle || !Array.isArray(bundle.products) || bundle.products.length === 0) {
      throw new Error('Invalid bundle metadata in recommendation');
    }

    // Enforce merchant discount guard rail (max 10%)
    const merchantConfigRepo = this.dataSource.getRepository('MerchantConfig');
    const configs: any[] = await merchantConfigRepo.find({ take: 1 });
    const merchantConfig = configs[0] || null;
    const maxDiscountPercent = merchantConfig?.max_discount_percent ? Math.min(10, Number(merchantConfig.max_discount_percent)) : 10;
    const discountPercent = Math.min(maxDiscountPercent, Number(bundle.discount_percent || 10));

    // Validate and add each product to cart
    for (const item of bundle.products) {
      const targetProductId = typeof item === 'string' ? item : (item.id || item.product_id);
      if (!targetProductId) {
        throw new Error('Invalid product ID in bundle metadata');
      }
      await this.addToCart(cartId, targetProductId, 1);
    }

    // Refresh cart after adding items
    const updatedCart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!updatedCart) throw new Error('Cart not found after bundle add');

    // Calculate bundle subtotal and discount ONLY on bundle products
    const bundleProductIds = new Set((bundle.products || []).map((p: any) => p.id));
    let bundle_subtotal_cents = 0;

    for (const ci of updatedCart.items || []) {
      if (bundleProductIds.has(ci.product_id)) {
        const p = await this.getProductRepository().findOne({ where: { id: ci.product_id } });
        if (p) {
          bundle_subtotal_cents += Number(p.price_cents) * ci.quantity;
        }
      }
    }

    const discount_cents = Math.round(bundle_subtotal_cents * (discountPercent / 100));

    updatedCart.bundle_recommendation_id = recommendationId;
    updatedCart.discount_percent = discountPercent;
    updatedCart.discount_cents = discount_cents;

    await this.getCartRepository().save(updatedCart);

    return this.cartToResponse(updatedCart);
  }

  private async cartToResponse(cart: Cart): Promise<CartResponse> {
    let subtotal_cents = 0;
    const items: CartItemResponse[] = (cart.items || []).map((item) => {
      const line_total = Number(item.price_cents) * item.quantity;
      subtotal_cents += line_total;
      return {
        id: item.id,
        product_id: item.product_id,
        product: item.product,
        quantity: item.quantity,
        price_cents: Number(item.price_cents),
        line_total_cents: line_total,
      };
    });

    const discount_percent = Number(cart.discount_percent || 0);
    let discount_cents = 0;

    if (discount_percent > 0 && cart.bundle_recommendation_id) {
      try {
        const recRepo = this.dataSource.getRepository(Recommendation);
        const recommendation: any = await recRepo.findOne({
          where: { id: cart.bundle_recommendation_id },
        });

        const bundle = recommendation?.metadata?.bundle;
        if (bundle && Array.isArray(bundle.products) && bundle.products.length > 0) {
          const bundleProductIds = new Set(bundle.products.map((p: any) => p.id));
          let bundle_subtotal = 0;
          for (const item of cart.items || []) {
            if (bundleProductIds.has(item.product_id)) {
              bundle_subtotal += Number(item.price_cents) * item.quantity;
            }
          }
          discount_cents = Math.round(bundle_subtotal * (discount_percent / 100));
        } else {
          // Fallback if bundle metadata is missing: use stored discount_cents or 0
          discount_cents = Number(cart.discount_cents || 0);
        }
      } catch (err) {
        discount_cents = Number(cart.discount_cents || 0);
      }
    } else if (cart.discount_cents) {
      discount_cents = Number(cart.discount_cents);
    }

    discount_cents = Math.min(discount_cents, subtotal_cents);
    const total_cents = Math.max(0, subtotal_cents - discount_cents);

    return {
      id: cart.id,
      customer_id: cart.customer_id,
      items,
      subtotal_cents,
      discount_percent,
      discount_cents,
      total_cents,
      bundle_recommendation_id: cart.bundle_recommendation_id,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    } as any;
  }
}

export const cartService = new CartService();
