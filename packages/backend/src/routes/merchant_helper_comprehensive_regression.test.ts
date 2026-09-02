import { TestDataSource, initializeTestDatabase } from '../config/database.test.js';
import { MerchantHelperService } from '../services/MerchantHelperService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { seedDatabase } from '../seed.js';

describe('Merchant Helper & Analytics Comprehensive 18-Point Regression Suite', () => {
  let helperService: MerchantHelperService;
  let analyticsService: AnalyticsService;
  let merchantA: Merchant;
  let merchantB: Merchant;
  let custA: Customer;

  beforeAll(async () => {
    await initializeTestDatabase();
    analyticsService = new AnalyticsService(TestDataSource);
    helperService = new MerchantHelperService(TestDataSource);
  });

  beforeEach(async () => {
    const queryRunner = TestDataSource.createQueryRunner();
    // Use CASCADE to handle all FK dependencies in one atomic operation
    await queryRunner.query(`
      TRUNCATE TABLE
        audit_logs, agent_decisions, recommendation_events, recovery_actions,
        recovery_cases, promises_to_pay, order_feedbacks, customer_interactions,
        payment_attempts, payments, order_timeline, recommendations,
        cart_items, carts, order_items, orders,
        inventory, products, customers, merchants
      CASCADE
    `);
    await queryRunner.release();

    const merchantRepo = TestDataSource.getRepository(Merchant);
    const customerRepo = TestDataSource.getRepository(Customer);

    merchantA = await merchantRepo.save(
      merchantRepo.create({
        id: '11111111-1111-1111-1111-111111111111',
        email: `merchantA-${Date.now()}@domain.com`,
        name: 'Merchant A',
        status: 'active',
      })
    );

    merchantB = await merchantRepo.save(
      merchantRepo.create({
        id: '22222222-2222-2222-2222-222222222222',
        email: `merchantB-${Date.now()}@domain.com`,
        name: 'Merchant B',
        status: 'active',
      })
    );

    custA = await customerRepo.save(
      customerRepo.create({
        email: `custA-${Date.now()}@domain.com`,
        name: 'Customer A',
        role: 'customer',
      })
    );
  });

  it('1. Clean database with no carts returns Helper = 0 and Analytics = 0', async () => {
    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    const metrics = await analyticsService.getDashboardMetrics(merchantA.id);
    const helperResp = await helperService.processChatMessage(merchantA.id, 'how many abandoned carts?');

    expect(canonical.abandonedCartsCount).toBe(0);
    expect(metrics.abandoned_carts_count).toBe(0);
    expect(helperResp.message).toContain('0 abandoned cart');
  });

  it('2. One abandoned cart with multiple products returns count = 1', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Prod 1', price_cents: 1000, merchant_id: merchantA.id }));
    const p2 = await productRepo.save(productRepo.create({ name: 'Prod 2', price_cents: 2000, merchant_id: merchantA.id }));

    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p2.id, quantity: 1, price_cents: 2000 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.abandonedCartsCount).toBe(1);
    expect(canonical.carts[0].items.length).toBe(2);
  });

  it('3. One cart with quantities > 1 returns count = 1', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Bulk Prod', price_cents: 500, merchant_id: merchantA.id }));
    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 10, price_cents: 500 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.abandonedCartsCount).toBe(1);
    expect(canonical.totalUnitsCount).toBe(10);
  });

  it('4. Two carts belonging to same customer: cart count = 2, unique customer count = 1', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Prod A', price_cents: 1000, merchant_id: merchantA.id }));

    const c1 = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c1.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const c2 = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 15 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c2.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.uniqueCartInstancesCount).toBe(2);
    expect(canonical.uniqueCustomersCount).toBe(1);
  });

  it('5. Previously abandoned cart successfully converted: current abandoned count = 0', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Prod X', price_cents: 1000, merchant_id: merchantA.id }));
    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'converted', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.abandonedCartsCount).toBe(0);
  });

  it('6. Cart updated 3 minutes ago (before 5-minute timeout) is NOT abandoned', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Prod Y', price_cents: 1000, merchant_id: merchantA.id }));
    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'active', updated_at: new Date(Date.now() - 3 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.abandonedCartsCount).toBe(0);
  });

  it('7. Cart updated 6 minutes ago (after 5-minute timeout) IS abandoned', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Prod Z', price_cents: 1000, merchant_id: merchantA.id }));
    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'active', updated_at: new Date(Date.now() - 6 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.abandonedCartsCount).toBe(1);
  });

  it('8. Multiple cart_items joined in SQL: COUNT(DISTINCT cart.id) prevents inflated count', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'P1', price_cents: 1000, merchant_id: merchantA.id }));
    const p2 = await productRepo.save(productRepo.create({ name: 'P2', price_cents: 2000, merchant_id: merchantA.id }));
    const p3 = await productRepo.save(productRepo.create({ name: 'P3', price_cents: 3000, merchant_id: merchantA.id }));

    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p2.id, quantity: 1, price_cents: 2000 }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p3.id, quantity: 1, price_cents: 3000 }));

    const metrics = await analyticsService.getDashboardMetrics(merchantA.id);
    expect(metrics.abandoned_carts_count).toBe(1);
  });

  it('9. "All abandoned carts" action includes every qualifying cart', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Bulk P1', price_cents: 1000, merchant_id: merchantA.id }));

    const c1 = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c1.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const c2 = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 12 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c2.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const resp = await helperService.processChatMessage(merchantA.id, 'give 40% off on all abandoned carts');
    expect(resp.requiresConfirmation).toBe(true);
    expect(resp.proposal?.affectedCartsList?.length).toBe(2);
  });

  it('10. Multi-product abandoned cart deal applies to EVERY product in the cart', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Multi P1', price_cents: 1000, merchant_id: merchantA.id }));
    const p2 = await productRepo.save(productRepo.create({ name: 'Multi P2', price_cents: 2000, merchant_id: merchantA.id }));

    const cart = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: p2.id, quantity: 1, price_cents: 2000 }));

    const propResp = await helperService.processChatMessage(merchantA.id, 'give 50% off on this cart');
    expect(propResp.requiresConfirmation).toBe(true);

    const confirmResp = await helperService.processChatMessage(merchantA.id, 'yes confirm action', propResp.proposal);
    expect(confirmResp.actionExecuted).toBe(true);

    const updatedP1 = await productRepo.findOne({ where: { id: p1.id } });
    const updatedP2 = await productRepo.findOne({ where: { id: p2.id } });

    expect(Number(updatedP1?.price_cents)).toBe(500);
    expect(Number(updatedP2?.price_cents)).toBe(1000);
  });

  it('11. All eligible customers receive promotional email when confirmed', async () => {
    const customerRepo = TestDataSource.getRepository(Customer);
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const cust1 = await customerRepo.save(customerRepo.create({ email: `cust1-${Date.now()}@domain.com`, name: 'Cust 1', role: 'customer' }));
    const cust2 = await customerRepo.save(customerRepo.create({ email: `cust2-${Date.now()}@domain.com`, name: 'Cust 2', role: 'customer' }));

    const p1 = await productRepo.save(productRepo.create({ name: 'Email Prod', price_cents: 1000, merchant_id: merchantA.id }));

    const c1 = await cartRepo.save(cartRepo.create({ customer_id: cust1.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c1.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const c2 = await cartRepo.save(cartRepo.create({ customer_id: cust2.id, status: 'abandoned', updated_at: new Date(Date.now() - 12 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c2.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const propResp = await helperService.processChatMessage(merchantA.id, 'give 30% off on all abandoned carts and email them');
    const confirmResp = await helperService.processChatMessage(merchantA.id, 'yes confirm', propResp.proposal);

    expect(confirmResp.actionExecuted).toBe(true);
    expect(confirmResp.message).toContain('notified');
  });

  it('12. Nonexistent order #1234: assistant does NOT resolve to another order', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const orderRepo = TestDataSource.getRepository(Order);
    const orderItemRepo = TestDataSource.getRepository(OrderItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Order Prod', price_cents: 1000, merchant_id: merchantA.id }));
    const realOrder = await orderRepo.save(orderRepo.create({
      order_number: 'ORD-999999',
      status: 'confirmed',
      customer_id: custA.id,
      subtotal_cents: 1000,
      total_cents: 1000,
    }));
    await orderItemRepo.save(orderItemRepo.create({ order_id: realOrder.id, product_id: p1.id, quantity: 1, price_cents: 1000, line_total_cents: 1000 }));

    const resp = await helperService.processChatMessage(merchantA.id, 'Initiate refund for order #1234');
    expect(resp.proposal).toBeNull();
    expect(resp.message).toContain("couldn't find order #1234");
    expect(resp.message).not.toContain('ORD-999999');
  });

  it('13. Exact valid order number: correct order is resolved', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const orderRepo = TestDataSource.getRepository(Order);
    const orderItemRepo = TestDataSource.getRepository(OrderItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Order Prod', price_cents: 1000, merchant_id: merchantA.id }));
    const realOrder = await orderRepo.save(orderRepo.create({
      order_number: 'ORD-20260830-0099',
      status: 'confirmed',
      customer_id: custA.id,
      subtotal_cents: 1000,
      total_cents: 1000,
    }));
    await orderItemRepo.save(orderItemRepo.create({ order_id: realOrder.id, product_id: p1.id, quantity: 1, price_cents: 1000, line_total_cents: 1000 }));

    const resp = await helperService.processChatMessage(merchantA.id, 'Initiate refund for order #ORD-20260830-0099');
    expect(resp.requiresConfirmation).toBe(true);
    expect(resp.proposal?.orderNumber).toBe('ORD-20260830-0099');
  });

  it('14. Ambiguous partial order identifier: assistant asks merchant to select instead of guessing', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const orderRepo = TestDataSource.getRepository(Order);
    const orderItemRepo = TestDataSource.getRepository(OrderItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Order Prod', price_cents: 1000, merchant_id: merchantA.id }));

    const o1 = await orderRepo.save(orderRepo.create({ order_number: 'ORD-777-A', status: 'confirmed', customer_id: custA.id, subtotal_cents: 1000, total_cents: 1000 }));
    await orderItemRepo.save(orderItemRepo.create({ order_id: o1.id, product_id: p1.id, quantity: 1, price_cents: 1000, line_total_cents: 1000 }));

    const o2 = await orderRepo.save(orderRepo.create({ order_number: 'ORD-777-B', status: 'confirmed', customer_id: custA.id, subtotal_cents: 1000, total_cents: 1000 }));
    await orderItemRepo.save(orderItemRepo.create({ order_id: o2.id, product_id: p1.id, quantity: 1, price_cents: 1000, line_total_cents: 1000 }));

    const resp = await helperService.processChatMessage(merchantA.id, 'Initiate refund for order 777');
    expect(resp.proposal).toBeNull();
    expect(resp.message).toContain('multiple orders matching');
    expect(resp.message).toContain('ORD-777-A');
    expect(resp.message).toContain('ORD-777-B');
  });

  it("15. Merchant A cannot access Merchant B's carts/orders/customers", async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const pB = await productRepo.save(productRepo.create({ name: 'Merchant B Prod', price_cents: 1000, merchant_id: merchantB.id }));

    const cB = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cB.id, product_id: pB.id, quantity: 1, price_cents: 1000 }));

    const canonicalA = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonicalA.abandonedCartsCount).toBe(0);

    const canonicalB = await analyticsService.getAbandonedCartsCanonical(merchantB.id);
    expect(canonicalB.abandonedCartsCount).toBe(1);
  });

  it('16. No truncated subset is used to execute an "all abandoned carts" action', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Prod Multi', price_cents: 1000, merchant_id: merchantA.id }));

    for (let i = 0; i < 3; i++) {
      const c = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - (10 + i) * 60 * 1000) }));
      await cartItemRepo.save(cartItemRepo.create({ cart_id: c.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));
    }

    const resp = await helperService.processChatMessage(merchantA.id, 'give 10% off to all abandoned carts');
    expect(resp.proposal?.affectedCartsList?.length).toBe(3);
  });

  it('17. Analytics and Merchant Helper use the same abandoned-cart source of truth', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    const p1 = await productRepo.save(productRepo.create({ name: 'Shared Prod', price_cents: 1000, merchant_id: merchantA.id }));

    const c1 = await cartRepo.save(cartRepo.create({ customer_id: custA.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) }));
    await cartItemRepo.save(cartItemRepo.create({ cart_id: c1.id, product_id: p1.id, quantity: 1, price_cents: 1000 }));

    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    const metrics = await analyticsService.getDashboardMetrics(merchantA.id);
    const helperResp = await helperService.processChatMessage(merchantA.id, 'how many abandoned carts?');

    expect(metrics.abandoned_carts_count).toBe(canonical.abandonedCartsCount);
    expect(helperResp.message).toContain(`${canonical.abandonedCartsCount} abandoned cart`);
  });

  it('18. Starting the local database/seed process does not unexpectedly create test carts', async () => {
    await seedDatabase(TestDataSource);
    const canonical = await analyticsService.getAbandonedCartsCanonical(merchantA.id);
    expect(canonical.abandonedCartsCount).toBe(0);
  });
});
