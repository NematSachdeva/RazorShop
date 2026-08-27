import { AppDataSource } from '../config/database.js';
import { DataSource } from 'typeorm';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';

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
  constructor(private dataSource: DataSource = AppDataSource) {}

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

    return this.cartToResponse(cart);
  }

  async getCartById(cartId: string): Promise<CartResponse | null> {
    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) return null;

    return this.cartToResponse(cart);
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
    return this.cartToResponse(cart);
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
    return this.cartToResponse(cart);
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
    return this.cartToResponse(cart);
  }

  async clearCart(cartId: string): Promise<CartResponse> {
    await this.getCartItemRepository().delete({ cart_id: cartId });

    const cart = await this.getCartRepository().findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });

    if (!cart) throw new Error('Cart not found');
    return this.cartToResponse(cart);
  }

  private cartToResponse(cart: Cart): CartResponse {
    let subtotal_cents = 0;
    const items: CartItemResponse[] = (cart.items || []).map((item) => {
      const line_total = item.price_cents * item.quantity;
      subtotal_cents += line_total;
      return {
        id: item.id,
        product_id: item.product_id,
        product: item.product,
        quantity: item.quantity,
        price_cents: item.price_cents,
        line_total_cents: line_total,
      };
    });

    return {
      id: cart.id,
      customer_id: cart.customer_id,
      items,
      subtotal_cents,
      total_cents: subtotal_cents, // No discounts in M2
      created_at: cart.created_at,
      updated_at: cart.updated_at,
    };
  }
}

export const cartService = new CartService();
