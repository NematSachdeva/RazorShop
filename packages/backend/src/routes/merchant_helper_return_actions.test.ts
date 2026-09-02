import { TestDataSource, initializeTestDatabase } from '../config/database.test.js';
import { MerchantHelperService } from '../services/MerchantHelperService.js';
import { OrderService } from '../services/OrderService.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';

describe('Merchant Helper Return Requests & Accept/Reject Actions', () => {
  let helperService: MerchantHelperService;
  let orderService: OrderService;
  let merchant: Merchant;
  let customer: Customer;
  let product1: Product;
  let product2: Product;

  beforeAll(async () => {
    await initializeTestDatabase();
    orderService = new OrderService(TestDataSource);
    helperService = new MerchantHelperService(TestDataSource, undefined as any, orderService);
  });

  beforeEach(async () => {
    const queryRunner = TestDataSource.createQueryRunner();
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
    const productRepo = TestDataSource.getRepository(Product);

    merchant = await merchantRepo.save(
      merchantRepo.create({
        id: '11111111-1111-1111-1111-111111111111',
        email: `merchant-return-${Date.now()}@domain.com`,
        name: 'Return Test Merchant',
        status: 'active',
      })
    );

    customer = await customerRepo.save(
      customerRepo.create({
        email: `customer-return-${Date.now()}@domain.com`,
        name: 'Nemat Sachdeva',
        password_hash: 'hashed',
        role: 'customer',
      })
    );

    product1 = await productRepo.save(
      productRepo.create({
        merchant_id: merchant.id,
        name: 'Multimeter',
        price_cents: 49900,
        category: 'Electrical & Gadgets',
      })
    );

    product2 = await productRepo.save(
      productRepo.create({
        merchant_id: merchant.id,
        name: 'Soldering Iron',
        price_cents: 79900,
        category: 'Electrical & Gadgets',
      })
    );
  });

  it('1. "kitne return request aayi hai" returns exact pending return request count (0 when empty)', async () => {
    const res = await helperService.processChatMessage(merchant.id, 'kitne return request aayi hai');
    expect(res.message).toMatch(/0 pending return request/i);
    expect(res.message).not.toMatch(/Hair Oil/i);
  });

  it('2. "return request?" returns actual pending return request details from DB', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const itemRepo = TestDataSource.getRepository(OrderItem);

    const order = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-20260902-00001',
        customer_id: customer.id,
        status: 'return_requested',
        return_status: 'return_requested',
        return_reason: 'Defective multimeter LCD display',
        subtotal_cents: 129800,
        tax_cents: 0,
        total_cents: 129800,
        return_requested_at: new Date(),
      })
    );

    await itemRepo.save([
      itemRepo.create({ order_id: order.id, product_id: product1.id, quantity: 1, price_cents: 49900, line_total_cents: 49900 }),
      itemRepo.create({ order_id: order.id, product_id: product2.id, quantity: 1, price_cents: 79900, line_total_cents: 79900 }),
    ]);

    const res = await helperService.processChatMessage(merchant.id, 'return request?');
    expect(res.message).toMatch(/1 pending return request/i);
    expect(res.message).toMatch(/ORD-20260902-00001/);
    expect(res.message).toMatch(/Nemat Sachdeva/);
    expect(res.message).toMatch(/Defective multimeter LCD display/);
    expect(res.message).toMatch(/Return Requested/i);
  });

  it('3. "reject this return" creates an action proposal to reject the return', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const itemRepo = TestDataSource.getRepository(OrderItem);

    const order = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-20260902-00002',
        customer_id: customer.id,
        status: 'return_requested',
        return_status: 'return_requested',
        return_reason: 'Changed mind',
        subtotal_cents: 49900,
        tax_cents: 0,
        total_cents: 49900,
        return_requested_at: new Date(),
      })
    );
    await itemRepo.save([itemRepo.create({ order_id: order.id, product_id: product1.id, quantity: 1, price_cents: 49900, line_total_cents: 49900 })]);

    const res = await helperService.processChatMessage(merchant.id, 'reject this return');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.proposal).not.toBeNull();
    expect(res.proposal?.actionType).toBe('PROCESS_RETURN');
    expect(res.proposal?.newReturnStatus).toBe('return_rejected');
    expect(res.proposal?.orderNumber).toBe('ORD-20260902-00002');
  });

  it('4. Confirming reject return actually updates DB state to return_rejected', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const itemRepo = TestDataSource.getRepository(OrderItem);

    const order = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-20260902-00003',
        customer_id: customer.id,
        status: 'return_requested',
        return_status: 'return_requested',
        return_reason: 'Not needed',
        subtotal_cents: 49900,
        tax_cents: 0,
        total_cents: 49900,
        return_requested_at: new Date(),
      })
    );
    await itemRepo.save([itemRepo.create({ order_id: order.id, product_id: product1.id, quantity: 1, price_cents: 49900, line_total_cents: 49900 })]);

    const propRes = await helperService.processChatMessage(merchant.id, 'is return ko reject karo');
    expect(propRes.proposal).not.toBeNull();

    const confirmRes = await helperService.processChatMessage(merchant.id, 'yes', propRes.proposal);
    expect(confirmRes.actionExecuted).toBe(true);
    expect(confirmRes.message).toMatch(/rejected successfully/i);

    const updatedOrder = await orderRepo.findOne({ where: { id: order.id } });
    expect(updatedOrder?.return_status).toBe('return_rejected');
    expect(updatedOrder?.status).toBe('return_rejected');
  });

  it('5. "accept this return" creates action proposal and confirming actually updates DB state to return_approved', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const itemRepo = TestDataSource.getRepository(OrderItem);

    const order = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-20260902-00004',
        customer_id: customer.id,
        status: 'return_requested',
        return_status: 'return_requested',
        return_reason: 'Defective product',
        subtotal_cents: 79900,
        tax_cents: 0,
        total_cents: 79900,
        return_requested_at: new Date(),
      })
    );
    await itemRepo.save([itemRepo.create({ order_id: order.id, product_id: product2.id, quantity: 1, price_cents: 79900, line_total_cents: 79900 })]);

    const propRes = await helperService.processChatMessage(merchant.id, 'accept this return');
    expect(propRes.proposal).not.toBeNull();
    expect(propRes.proposal?.newReturnStatus).toBe('return_approved');

    const confirmRes = await helperService.processChatMessage(merchant.id, 'confirm', propRes.proposal);
    expect(confirmRes.actionExecuted).toBe(true);
    expect(confirmRes.message).toMatch(/approved successfully/i);

    const updatedOrder = await orderRepo.findOne({ where: { id: order.id } });
    expect(updatedOrder?.return_status).toBe('return_approved');
    expect(updatedOrder?.status).toBe('return_approved');
  });

  it('6. "second wali accept karo" correctly targets the 2nd return request in list', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const itemRepo = TestDataSource.getRepository(OrderItem);

    const order1 = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-FIRST',
        customer_id: customer.id,
        status: 'return_requested',
        return_status: 'return_requested',
        return_reason: 'First return',
        subtotal_cents: 1000,
        tax_cents: 0,
        total_cents: 1000,
        return_requested_at: new Date(Date.now() - 10000),
      })
    );

    const order2 = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-SECOND',
        customer_id: customer.id,
        status: 'return_requested',
        return_status: 'return_requested',
        return_reason: 'Second return',
        subtotal_cents: 2000,
        tax_cents: 0,
        total_cents: 2000,
        return_requested_at: new Date(),
      })
    );

    await itemRepo.save([
      itemRepo.create({ order_id: order1.id, product_id: product1.id, quantity: 1, price_cents: 1000, line_total_cents: 1000 }),
      itemRepo.create({ order_id: order2.id, product_id: product2.id, quantity: 1, price_cents: 2000, line_total_cents: 2000 }),
    ]);

    const res = await helperService.processChatMessage(merchant.id, 'second wali accept karo');
    expect(res.proposal).not.toBeNull();
    expect(res.proposal?.newReturnStatus).toBe('return_approved');
    expect(res.proposal?.orderNumber).toBeDefined();
  });
});
