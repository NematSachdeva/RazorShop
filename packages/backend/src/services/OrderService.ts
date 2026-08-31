import { AppDataSource } from '../config/database.js';
import { DataSource } from 'typeorm';
import { Order, OrderStatus, ShippingAddressSnapshot } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Customer } from '../models/Customer.js';
import { Recommendation } from '../models/Recommendation.js';
import { CustomerAddress } from '../models/CustomerAddress.js';
import { OrderTimeline, OrderTimelineEventType } from '../models/OrderTimeline.js';

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
  shipping_address?: ShippingAddressSnapshot | null;
  items: OrderItemDTO[];
  subtotal_cents: number;
  tax_cents: number;
  discount_cents?: number;
  total_cents: number;
  cancellation_reason?: string | null;
  cancellation_timestamp?: Date | string | null;
  cancelled_by?: 'customer' | 'merchant' | 'system' | null;
  refund_amount_cents?: number | null;
  refund_status?: string | null;
  return_status?: string | null;
  return_reason?: string | null;
  return_requested_at?: Date | string | null;
  return_approved_at?: Date | string | null;
  return_rejected_at?: Date | string | null;
  return_rejection_reason?: string | null;
  pickup_scheduled_at?: Date | string | null;
  pickup_notes?: string | null;
  picked_up_at?: Date | string | null;
  return_in_transit_at?: Date | string | null;
  returned_to_seller_at?: Date | string | null;
  refund_initiated_at?: Date | string | null;
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

  private getAddressRepository() {
    return this.dataSource.getRepository(CustomerAddress);
  }

  private getTimelineRepository() {
    return this.dataSource.getRepository(OrderTimeline);
  }

  /**
   * Create an order from a cart with full transaction support.
   * Handles inventory reservation, cart conversion, and proper locking.
   */
  async createOrderFromCart(
    cartId: string,
    customerId: string,
    shippingAddressPayload?: ShippingAddressSnapshot | null
  ): Promise<OrderDTO> {
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

      // Resolve address snapshot
      let finalAddress: ShippingAddressSnapshot | null = null;
      if (shippingAddressPayload && shippingAddressPayload.full_address) {
        finalAddress = {
          full_address: shippingAddressPayload.full_address.trim(),
          state: (shippingAddressPayload.state || '').trim(),
          pin_code: (shippingAddressPayload.pin_code || '').trim(),
          phone: shippingAddressPayload.phone ? shippingAddressPayload.phone.trim() : undefined,
          name: shippingAddressPayload.name ? shippingAddressPayload.name.trim() : customer.name || undefined,
        };
      } else {
        // Look up default address from database for this customer
        const defaultAddr = await queryRunner.manager.findOne(CustomerAddress, {
          where: { customer_id: customerId, is_default: true },
        });

        const fallbackAddr = defaultAddr || await queryRunner.manager.findOne(CustomerAddress, {
          where: { customer_id: customerId },
          order: { created_at: 'DESC' },
        });

        if (fallbackAddr) {
          finalAddress = {
            full_address: fallbackAddr.full_address,
            state: fallbackAddr.state,
            pin_code: fallbackAddr.pin_code,
            phone: fallbackAddr.phone || undefined,
            name: customer.name || undefined,
          };
        }
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
      } else if (cart.bundle_recommendation_id && cart.discount_percent && cart.discount_percent > 0) {
        try {
          const recRepo = queryRunner.manager.getRepository(Recommendation);
          const recommendation: any = await recRepo.findOne({ where: { id: cart.bundle_recommendation_id } });
          const bundle = recommendation?.metadata?.bundle;
          if (bundle && Array.isArray(bundle.products) && bundle.products.length > 0) {
            const bundleProductIds = new Set(bundle.products.map((p: any) => p.id || p.product_id));
            let bundleSubtotal = 0;
            for (const item of cartItems) {
              if (bundleProductIds.has(item.product_id)) {
                const p = productMap.get(item.product_id)!;
                bundleSubtotal += p.price_cents * item.quantity;
              }
            }
            discount_cents = Math.round(bundleSubtotal * (Number(cart.discount_percent) / 100));
          } else {
            discount_cents = Math.round(subtotal_cents * (Number(cart.discount_percent) / 100));
          }
        } catch {
          discount_cents = Math.round(subtotal_cents * (Number(cart.discount_percent) / 100));
        }
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
        shipping_address: finalAddress,
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

    // Verify uniqueness
    const existing = await manager.findOne(Order, {
      where: { order_number: orderNumber },
    });

    if (existing) {
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
   * Add a persistent timeline event for an order
   */
  async addTimelineEvent(
    orderId: string,
    eventType: OrderTimelineEventType,
    actorRole: 'customer' | 'merchant' | 'system' | 'admin' = 'system',
    actorId?: string,
    description?: string
  ): Promise<OrderTimeline> {
    const timelineRepo = this.getTimelineRepository();

    // Prevent duplicate event creation if same event already recorded recently
    const existing = await timelineRepo.findOne({
      where: { order_id: orderId, event_type: eventType },
    });

    if (existing) {
      return existing;
    }

    const event = timelineRepo.create({
      order_id: orderId,
      event_type: eventType,
      actor_role: actorRole,
      actor_id: actorId,
      description: description || `Order event ${eventType} recorded`,
    });

    return timelineRepo.save(event);
  }

  /**
   * Get chronological timeline for an order
   */
  async getOrderTimeline(orderId: string): Promise<OrderTimeline[]> {
    return this.getTimelineRepository().find({
      where: { order_id: orderId },
      order: { created_at: 'ASC' },
    });
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
   * Cancel an order (customer action)
   */
  async cancelOrder(orderId: string, customerId: string, reason: string): Promise<OrderDTO> {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new Error('Cancellation reason is required');
    }

    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.customer_id !== customerId) {
      throw new Error('Order does not belong to this customer');
    }

    const currentStatus = order.status;

    if (currentStatus === 'cancelled') {
      throw new Error('Order is already cancelled');
    }

    if (currentStatus === 'dispatched' || currentStatus === 'shipped') {
      throw new Error('Order cannot be cancelled after dispatch');
    }

    if (currentStatus === 'delivered') {
      throw new Error('Order cannot be cancelled after delivery');
    }

    if (currentStatus !== 'confirmed') {
      throw new Error(`Order cannot be cancelled in '${currentStatus}' status`);
    }

    order.status = 'cancelled';
    order.cancellation_reason = reason.trim();
    order.cancellation_timestamp = new Date();
    order.cancelled_by = 'customer';
    order.refund_amount_cents = Number(order.total_cents);
    order.refund_status = 'completed';

    // Restore inventory (idempotent: restore stock when cancellation is saved for the first time)
    if (order.items && order.items.length > 0) {
      const inventoryRepo = this.dataSource.getRepository(Inventory);
      for (const item of order.items) {
        const inv = await inventoryRepo.findOne({ where: { product_id: item.product_id } });
        if (inv) {
          inv.quantity_on_hand += item.quantity;
          if (inv.reserved > 0) {
            inv.reserved = Math.max(0, inv.reserved - item.quantity);
          }
          inv.last_updated = new Date();
          await inventoryRepo.save(inv);
        }
      }
    }

    const savedOrder = await this.getOrderRepository().save(order);

    const existingTimeline = await this.getTimelineRepository().findOne({
      where: { order_id: orderId, event_type: 'ORDER_CANCELLED' },
    });

    if (!existingTimeline) {
      await this.addTimelineEvent(
        orderId,
        'ORDER_CANCELLED',
        'customer',
        customerId,
        `Order cancelled by customer: ${reason.trim()}`
      );

      if (order.customer?.email) {
        try {
          const { emailService } = await import('./EmailService.js');
          await emailService.sendOrderCancelledNotification(
            order.customer.email,
            order.customer.name || 'Valued Customer',
            order.order_number,
            {
              orderId: order.id,
              amountCents: Number(order.total_cents),
              reason: reason.trim(),
            }
          );
        } catch (emailErr) {
          console.error('[OrderService] Failed to send cancellation email:', emailErr);
        }
      }
    }

    return this.orderToDTO(savedOrder, savedOrder.items || []);
  }

  /**
   * Request a return for a delivered order (customer action)
   */
  async requestReturn(orderId: string, customerId: string, reason: string): Promise<OrderDTO> {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new Error('Return reason is required');
    }

    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.customer_id !== customerId) {
      throw new Error('Order does not belong to this customer');
    }

    if (order.status !== 'delivered') {
      throw new Error('Return can only be requested for delivered orders');
    }

    if (order.return_status && order.return_status !== 'none') {
      throw new Error(`Return request already exists with status '${order.return_status}'`);
    }

    order.status = 'return_requested';
    order.return_status = 'return_requested';
    order.return_reason = reason.trim();
    order.return_requested_at = new Date();

    const savedOrder = await this.getOrderRepository().save(order);

    const existingTimeline = await this.getTimelineRepository().findOne({
      where: { order_id: orderId, event_type: 'RETURN_REQUESTED' },
    });

    if (!existingTimeline) {
      await this.addTimelineEvent(
        orderId,
        'RETURN_REQUESTED',
        'customer',
        customerId,
        `Return requested by customer: ${reason.trim()}`
      );

      if (order.customer?.email) {
        try {
          const { emailService } = await import('./EmailService.js');
          await emailService.sendReturnStatusNotification(
            order.customer.email,
            order.customer.name || 'Valued Customer',
            order.order_number,
            {
              orderId: order.id,
              status: 'RETURN_REQUESTED',
              reason: reason.trim(),
            }
          );
        } catch (emailErr) {
          console.error('[OrderService] Failed to send return requested email:', emailErr);
        }
      }
    }

    return this.orderToDTO(savedOrder, savedOrder.items || []);
  }

  /**
   * Approve a return request (merchant action)
   */
  async approveReturn(orderId: string, merchantId: string): Promise<OrderDTO> {
    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.return_status !== 'return_requested') {
      throw new Error(`Cannot approve return in '${order.return_status || order.status}' status`);
    }

    order.status = 'return_approved';
    order.return_status = 'return_approved';
    order.return_approved_at = new Date();

    const savedOrder = await this.getOrderRepository().save(order);

    const existingTimeline = await this.getTimelineRepository().findOne({
      where: { order_id: orderId, event_type: 'RETURN_APPROVED' },
    });

    if (!existingTimeline) {
      await this.addTimelineEvent(
        orderId,
        'RETURN_APPROVED',
        'merchant',
        merchantId,
        'Return request approved by merchant'
      );

      if (order.customer?.email) {
        try {
          const { emailService } = await import('./EmailService.js');
          await emailService.sendReturnStatusNotification(
            order.customer.email,
            order.customer.name || 'Valued Customer',
            order.order_number,
            {
              orderId: order.id,
              status: 'RETURN_APPROVED',
              reason: order.return_reason || undefined,
            }
          );
        } catch (emailErr) {
          console.error('[OrderService] Failed to send return approved email:', emailErr);
        }
      }
    }

    return this.orderToDTO(savedOrder, savedOrder.items || []);
  }

  /**
   * Reject a return request (merchant action)
   */
  async rejectReturn(orderId: string, merchantId: string, reason?: string): Promise<OrderDTO> {
    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.return_status !== 'return_requested') {
      throw new Error(`Cannot reject return in '${order.return_status || order.status}' status`);
    }

    order.status = 'return_rejected';
    order.return_status = 'return_rejected';
    order.return_rejected_at = new Date();
    order.return_rejection_reason = reason ? reason.trim() : null;

    const savedOrder = await this.getOrderRepository().save(order);

    const existingTimeline = await this.getTimelineRepository().findOne({
      where: { order_id: orderId, event_type: 'RETURN_REJECTED' },
    });

    if (!existingTimeline) {
      await this.addTimelineEvent(
        orderId,
        'RETURN_REJECTED',
        'merchant',
        merchantId,
        `Return request rejected by merchant${reason ? `: ${reason.trim()}` : ''}`
      );

      if (order.customer?.email) {
        try {
          const { emailService } = await import('./EmailService.js');
          await emailService.sendReturnStatusNotification(
            order.customer.email,
            order.customer.name || 'Valued Customer',
            order.order_number,
            {
              orderId: order.id,
              status: 'RETURN_REJECTED',
              rejectionReason: reason ? reason.trim() : undefined,
            }
          );
        } catch (emailErr) {
          console.error('[OrderService] Failed to send return rejected email:', emailErr);
        }
      }
    }

    return this.orderToDTO(savedOrder, savedOrder.items || []);
  }

  /**
   * Update return logistics progression (merchant action)
   */
  async updateReturnLogistics(
    orderId: string,
    merchantId: string,
    targetStatus: 'pickup_scheduled' | 'order_picked_up' | 'return_in_transit' | 'order_returned_to_seller',
    details?: { pickupNotes?: string }
  ): Promise<OrderDTO> {
    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const currentReturnStatus = order.return_status || order.status;

    if (targetStatus === 'pickup_scheduled') {
      if (currentReturnStatus !== 'return_approved') {
        throw new Error(`Cannot schedule pickup before return approval. Current status is '${currentReturnStatus}'`);
      }
      order.status = 'pickup_scheduled';
      order.return_status = 'pickup_scheduled';
      order.pickup_scheduled_at = new Date();
      if (details?.pickupNotes) {
        order.pickup_notes = details.pickupNotes.trim();
      }
    } else if (targetStatus === 'order_picked_up') {
      if (currentReturnStatus !== 'pickup_scheduled') {
        throw new Error(`Cannot mark picked up before pickup is scheduled. Current status is '${currentReturnStatus}'`);
      }
      order.status = 'order_picked_up';
      order.return_status = 'order_picked_up';
      order.picked_up_at = new Date();
    } else if (targetStatus === 'return_in_transit') {
      if (currentReturnStatus !== 'order_picked_up') {
        throw new Error(`Cannot mark return in transit before item is picked up. Current status is '${currentReturnStatus}'`);
      }
      order.status = 'return_in_transit';
      order.return_status = 'return_in_transit';
      order.return_in_transit_at = new Date();
    } else if (targetStatus === 'order_returned_to_seller') {
      if (currentReturnStatus !== 'return_in_transit') {
        throw new Error(`Cannot mark returned to seller before return is in transit. Current status is '${currentReturnStatus}'`);
      }
      const isFirstTimeReturnedToSeller =
        order.return_status !== 'order_returned_to_seller' && order.return_status !== 'refund_initiated';

      order.status = 'order_returned_to_seller';
      order.return_status = 'order_returned_to_seller';
      order.returned_to_seller_at = new Date();

      if (isFirstTimeReturnedToSeller && order.items && order.items.length > 0) {
        const inventoryRepo = this.dataSource.getRepository(Inventory);
        for (const item of order.items) {
          const inv = await inventoryRepo.findOne({ where: { product_id: item.product_id } });
          if (inv) {
            inv.quantity_on_hand += item.quantity;
            inv.last_updated = new Date();
            await inventoryRepo.save(inv);
          }
        }
      }
    } else {
      throw new Error(`Invalid return logistics status: '${targetStatus}'`);
    }

    const savedOrder = await this.getOrderRepository().save(order);

    const eventTypeMap: Record<string, OrderTimelineEventType> = {
      pickup_scheduled: 'PICKUP_SCHEDULED',
      order_picked_up: 'ORDER_PICKED_UP',
      return_in_transit: 'RETURN_IN_TRANSIT',
      order_returned_to_seller: 'ORDER_RETURNED_TO_SELLER',
    };

    const eventType = eventTypeMap[targetStatus];
    const existingTimeline = await this.getTimelineRepository().findOne({
      where: { order_id: orderId, event_type: eventType },
    });

    if (!existingTimeline) {
      await this.addTimelineEvent(
        orderId,
        eventType,
        'merchant',
        merchantId,
        `Return logistics updated to ${targetStatus.replace(/_/g, ' ')}`
      );

      if (order.customer?.email) {
        try {
          const { emailService } = await import('./EmailService.js');
          await emailService.sendReturnStatusNotification(
            order.customer.email,
            order.customer.name || 'Valued Customer',
            order.order_number,
            {
              orderId: order.id,
              status: eventType,
              notes: details?.pickupNotes || undefined,
            }
          );
        } catch (emailErr) {
          console.error(`[OrderService] Failed to send ${eventType} email:`, emailErr);
        }
      }
    }

    return this.orderToDTO(savedOrder, savedOrder.items || []);
  }

  /**
   * Merchant action: Initiate refund after order is returned to seller
   */
  async initiateRefund(orderId: string, merchantId: string): Promise<OrderDTO> {
    const order = await this.getOrderRepository().findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const currentReturnStatus = order.return_status || order.status;

    if (currentReturnStatus === 'refund_initiated' || order.refund_initiated_at) {
      throw new Error('Refund has already been initiated for this order');
    }

    if (currentReturnStatus !== 'order_returned_to_seller') {
      throw new Error(`Cannot initiate refund before order is returned to seller. Current status is '${currentReturnStatus}'`);
    }

    order.status = 'refund_initiated';
    order.return_status = 'refund_initiated';
    order.refund_status = 'initiated';
    order.refund_amount_cents = order.total_cents;
    order.refund_initiated_at = new Date();

    const savedOrder = await this.getOrderRepository().save(order);

    const existingTimeline = await this.getTimelineRepository().findOne({
      where: { order_id: orderId, event_type: 'REFUND_INITIATED' },
    });

    if (!existingTimeline) {
      const formattedAmount = (Number(savedOrder.total_cents) / 100).toFixed(2);
      await this.addTimelineEvent(
        orderId,
        'REFUND_INITIATED',
        'merchant',
        merchantId,
        `Refund of ₹${formattedAmount} initiated to original payment source`
      );

      if (order.customer?.email) {
        try {
          const { emailService } = await import('./EmailService.js');
          await emailService.sendRefundInitiatedNotification(
            order.customer.email,
            order.customer.name || 'Valued Customer',
            order.order_number,
            {
              orderId: order.id,
              refundAmountCents: Number(order.total_cents),
              paymentSource: 'Original payment method',
            }
          );
        } catch (emailErr) {
          console.error('[OrderService] Failed to send refund initiated email:', emailErr);
        }
      }
    }

    return this.orderToDTO(savedOrder, savedOrder.items || []);
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
      shipping_address: order.shipping_address || null,
      items: itemDTOs,
      subtotal_cents: Number(order.subtotal_cents),
      tax_cents: Number(order.tax_cents),
      discount_cents: Number(order.discount_cents || 0),
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
      refund_initiated_at: order.refund_initiated_at || null,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }
}

export const orderService = new OrderService();

