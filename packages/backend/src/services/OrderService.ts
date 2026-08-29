import { AppDataSource } from '../config/database.js';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Customer } from '../models/Customer.js';

// Local DTO types (re-exported to maintain compatibility)
export interface OrderItemDTO {
  id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  price_cents: number;
  line_total_cents: number;
  created_at: Date;
}

export interface OrderDTO {
  id: string;
  customer_id: string;
  order_number: string;
  status: OrderStatus;
  items: OrderItemDTO[];
  subtotal_cents: number;
  tax_cents: number;
  discount_cents?: number;
  total_cents: number;
  created_at: Date;
  updated_at: Date;
}

export class OrderService {
  constructor(private dataSource: DataSource = AppDataSource) {}

  private getOrderRepository() {
    return this.dataSource.getRepository(Order);
  }

  private getOrderItemRepository() {
    return this.dataSource.getRepository(OrderItem);
  }

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

  private getCustomerRepository() {
    return this.dataSource.getRepository(Customer);
  }

  /**
   * Create an order from a cart with full transaction support.
   * Handles inventory reservation, cart conversion, and proper locking.
   */
  async createOrderFromCart(cartId: string, customerId: string): Promise<OrderDTO> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // 1. Lock the cart row to prevent concurrent conversions
      const cart = await queryRunner.manager
        .createQueryBuilder(Cart, 'cart')
        .setLock('pessimistic_write')
        .where('cart.id = :cartId', { cartId })
        .getOne();

      if (!cart) {
        throw new Error('Cart not found');
      }

      // 2. Verify cart ownership and status
      if (cart.customer_id !== customerId) {
        throw new Error('Cart does not belong to this customer');
      }

      if (cart.converted_to_order_id) {
        throw new Error('Cart has already been converted to an order');
      }

      if (cart.status !== 'active') {
        throw new Error('Cart is not active');
      }

      // 3. Load cart items
      const cartItems = await queryRunner.manager.find(CartItem, {
        where: { cart_id: cartId },
        relations: ['product'],
      });

      if (cartItems.length === 0) {
        throw new Error('Cannot create order from empty cart');
      }

      // 4. Verify customer exists
      const customer = await queryRunner.manager.findOne(Customer, {
        where: { id: customerId },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // 5. Verify all products exist and collect pricing
      const products = await queryRunner.manager.find(Product, {
        where: cartItems.map((item) => ({ id: item.product_id })),
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const cartItem of cartItems) {
        if (!productMap.has(cartItem.product_id)) {
          throw new Error(`Product ${cartItem.product_id} not found`);
        }

        if (cartItem.quantity <= 0) {
          throw new Error(`Invalid quantity for product ${cartItem.product_id}`);
        }
      }

      // 6. Check and reserve inventory atomically
      const inventoryUpdates: Array<{ productId: string; quantity: number }> = [];

      for (const cartItem of cartItems) {
        const inventory = await queryRunner.manager
          .createQueryBuilder(Inventory, 'inv')
          .setLock('pessimistic_write')
          .where('inv.product_id = :productId', { productId: cartItem.product_id })
          .getOne();

        if (!inventory) {
          throw new Error(`Inventory not found for product ${cartItem.product_id}`);
        }

        const available = inventory.quantity_on_hand - inventory.reserved;
        if (available < cartItem.quantity) {
          throw new Error(
            `Insufficient inventory for product ${cartItem.product_id}. ` +
              `Available: ${available}, Requested: ${cartItem.quantity}`
          );
        }

        inventoryUpdates.push({
          productId: cartItem.product_id,
          quantity: cartItem.quantity,
        });
      }

      // 7. Calculate order totals from database
      let subtotal_cents = 0;
      const orderItemsData: Array<{
        productId: string;
        quantity: number;
        priceCents: number;
        lineTotalCents: number;
      }> = [];

      for (const cartItem of cartItems) {
        const product = productMap.get(cartItem.product_id)!;
        const lineTotalCents = product.price_cents * cartItem.quantity;
        subtotal_cents += lineTotalCents;

        orderItemsData.push({
          productId: cartItem.product_id,
          quantity: cartItem.quantity,
          priceCents: product.price_cents,
          lineTotalCents,
        });
      }

      let discount_cents = 0;
      if (cart.discount_cents) {
        discount_cents = Number(cart.discount_cents);
      } else if (cart.discount_percent && cart.discount_percent > 0) {
        discount_cents = Math.round(subtotal_cents * (Number(cart.discount_percent) / 100));
      }
      discount_cents = Math.min(discount_cents, subtotal_cents);

      const tax_cents = 0; // M3: no tax calculation
      const total_cents = Math.max(0, subtotal_cents - discount_cents + tax_cents);

      // 8. Generate unique order number
      const orderNumber = await this.generateUniqueOrderNumber(queryRunner.manager);

      // 9. Create the order
      const order = queryRunner.manager.create(Order, {
        customer_id: customerId,
        order_number: orderNumber,
        status: 'pending',
        subtotal_cents,
        tax_cents,
        discount_cents,
        total_cents,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 10. Create order items
      const orderItems = orderItemsData.map((item) =>
        queryRunner.manager.create(OrderItem, {
          order_id: savedOrder.id,
          product_id: item.productId,
          quantity: item.quantity,
          price_cents: item.priceCents,
          line_total_cents: item.lineTotalCents,
        })
      );

      await queryRunner.manager.save(OrderItem, orderItems);

      // 11. Reserve inventory
      for (const update of inventoryUpdates) {
        await queryRunner.manager.increment(
          Inventory,
          { product_id: update.productId },
          'reserved',
          update.quantity
        );
      }

      // 12. Mark cart as converted
      cart.status = 'converted';
      cart.converted_to_order_id = savedOrder.id;
      await queryRunner.manager.save(cart);

      // 13. Commit transaction
      await queryRunner.commitTransaction();

      // 14. Return order with items
      return this.orderToDTO(savedOrder, orderItems);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate a unique order number in format ORD-YYYYMMDD-NNNNN
   */
  private async generateUniqueOrderNumber(manager: any): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `ORD-${year}${month}${day}`;

    // Find the highest counter for today
    const result = await manager
      .createQueryBuilder(Order, 'order')
      .select('COUNT(*)', 'count')
      .where('order.order_number LIKE :pattern', { pattern: `${datePrefix}%` })
      .getRawOne();

    const nextNumber = (result?.count || 0) + 1;
    const orderNumber = `${datePrefix}-${String(nextNumber).padStart(5, '0')}`;

    // Verify uniqueness (should be guaranteed by UNIQUE constraint, but double-check)
    const existing = await manager.findOne(Order, {
      where: { order_number: orderNumber },
    });

    if (existing) {
      // Collision (extremely rare), retry with incremented counter
      throw new Error('Order number collision. Please retry.');
    }

    return orderNumber;
  }

  /**
   * Get order by ID with items
   */
  async getOrderById(orderId: string): Promise<OrderDTO | null> {
    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) return null;

    return this.orderToDTO(order, order.items || []);
  }

  /**
   * Get order by order number with items
   */
  async getOrderByNumber(orderNumber: string): Promise<OrderDTO | null> {
    const order = await this.getOrderRepository().findOne({
      where: { order_number: orderNumber },
      relations: ['items', 'items.product'],
    });

    if (!order) return null;

    return this.orderToDTO(order, order.items || []);
  }

  /**
   * List orders for a customer with pagination
   */
  async listOrdersByCustomer(
    customerId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: OrderDTO[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const [orders, total] = await this.getOrderRepository().findAndCount({
      where: { customer_id: customerId },
      relations: ['items', 'items.product'],
      order: { created_at: 'DESC' },
      skip,
      take: validLimit,
    });

    const data = orders.map((order) => this.orderToDTO(order, order.items || []));

    return {
      data,
      total,
      page: validPage,
      limit: validLimit,
      pages: Math.ceil(total / validLimit),
    };
  }

  /**
   * Convert Order entity to OrderDTO
   */
  private orderToDTO(order: Order, items: OrderItem[]): OrderDTO {
    const itemDTOs: OrderItemDTO[] = items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product: item.product,
      quantity: item.quantity,
      price_cents: item.price_cents,
      line_total_cents: item.line_total_cents,
      created_at: item.created_at,
    }));

    return {
      id: order.id,
      customer_id: order.customer_id,
      order_number: order.order_number,
      status: order.status,
      items: itemDTOs,
      subtotal_cents: Number(order.subtotal_cents),
      tax_cents: Number(order.tax_cents),
      discount_cents: Number(order.discount_cents || 0),
      total_cents: Number(order.total_cents),
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }
}

export const orderService = new OrderService();
