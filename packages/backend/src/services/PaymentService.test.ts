/**
 * PaymentService tests.
 *
 * Concurrency approach:
 *   Node.js is single-threaded, so truly interleaved CPU execution is impossible.
 *   However, because every DB operation is an async await, PostgreSQL can begin
 *   processing a second request's queries while the first is awaiting a network
 *   round-trip.  Promise.all() exercises this interleaving at the I/O boundary.
 *
 *   The concurrency invariant we assert:
 *     "Two concurrent createPaymentAttempt calls for the same order MUST produce
 *      exactly ONE PaymentAttempt row and return the SAME razorpay_order_id."
 *
 *   The test FAILS if it ever sees two distinct razorpay_order_ids for attempt #1,
 *   because that means Razorpay.createOrder() was called twice.
 */

import { PaymentService, RazorpayClient } from './PaymentService.js';
import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { OrderService } from './OrderService.js';
import crypto from 'crypto';

// ─── Mock Razorpay client ────────────────────────────────────────────────────
/**
 * Each instance has its own counter so tests that share the module-level
 * `paymentService` don't bleed counts across test cases.
 * The counter is intentionally per-instance (not global) so sequential
 * createOrder() calls within one test case produce distinct IDs, letting us
 * assert whether one or two Razorpay orders were created.
 */
class MockRazorpayClient extends RazorpayClient {
  public createOrderCallCount = 0;

  constructor() {
    // key matches 'test_secret_mock' used to compute signatures in tests
    super('rzp_test_key', 'test_secret_mock');
  }

  override async createOrder(
    _amountPaise: number,
    _orderId: string
  ): Promise<{ id: string }> {
    this.createOrderCallCount += 1;
    // Use a timestamp so IDs are distinct across sequential calls even when
    // the counter is the same (shouldn't happen with per-instance counter, but
    // belt-and-suspenders).
    return { id: `rzp_mock_order_${this.createOrderCallCount}_${Date.now()}` };
  }
}

// Helper to build a correct HMAC signature for a PaymentAttempt row.
function buildSignature(razorpayOrderId: string, razorpayPaymentId: string): string {
  return crypto
    .createHmac('sha256', 'test_secret_mock')
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockRazorpayClient: MockRazorpayClient;

  let testCustomerId: string;
  let testProductId: string;
  let testOrderId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Fresh mock per test so createOrderCallCount starts at 0.
    mockRazorpayClient = new MockRazorpayClient();
    paymentService = new PaymentService(TestDataSource, mockRazorpayClient);

    // Customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `pay-test-${Date.now()}-${Math.random()}@example.com`,
      name: 'Pay Test User',
    });
    testCustomerId = (await customerRepo.save(customer)).id;

    // Product + inventory
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Widget',
      description: 'Widget for payment tests',
      price_cents: 50000, // ₹500
      category: 'test',
    });
    const savedProduct = await productRepo.save(product);
    testProductId = savedProduct.id;

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: testProductId,
        quantity_on_hand: 100,
        reserved: 0,
      })
    );

    // Cart + item
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = cartRepo.create({ customer_id: testCustomerId, status: 'active' });
    const savedCart = await cartRepo.save(cart);

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: savedCart.id,
        product_id: testProductId,
        quantity: 2,
        price_cents: 50000,
      })
    );

    // Order (total_cents = 2 × 50000 = 100 000)
    const orderService = new OrderService(TestDataSource);
    const order = await orderService.createOrderFromCart(savedCart.id, testCustomerId);
    testOrderId = order.id;
  });

  // ── createPaymentAttempt ──────────────────────────────────────────────────

  describe('createPaymentAttempt', () => {
    it('creates a payment and attempt on first call', async () => {
      const result = await paymentService.createPaymentAttempt(testOrderId);

      expect(result.razorpay_order_id).toMatch(/^rzp_mock_order_/);
      expect(result.currency).toBe('INR');
      expect(Number(result.amount_cents)).toBe(100_000);

      // Exactly one Razorpay order was created.
      expect(mockRazorpayClient.createOrderCallCount).toBe(1);

      // Payment row is 'pending'.
      const payment = await paymentService.getPaymentByOrderId(testOrderId);
      expect(payment?.status).toBe('pending');

      // Exactly one PaymentAttempt row exists.
      const attempts = await TestDataSource.getRepository(PaymentAttempt).find({
        where: { order_id: testOrderId },
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0].attempt_number).toBe(1);
      expect(attempts[0].razorpay_order_id).toBe(result.razorpay_order_id);
    });

    it('rejects a non-existent order', async () => {
      await expect(
        paymentService.createPaymentAttempt('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Order not found');
    });

    it('rejects an order that is not pending', async () => {
      const orderRepo = TestDataSource.getRepository(Order);
      const order = await orderRepo.findOneOrFail({ where: { id: testOrderId } });
      order.status = 'confirmed';
      await orderRepo.save(order);

      await expect(
        paymentService.createPaymentAttempt(testOrderId)
      ).rejects.toThrow('Order is not in pending state');
    });

    it('rejects when payment is already captured', async () => {
      await paymentService.createPaymentAttempt(testOrderId);

      const paymentRepo = TestDataSource.getRepository(Payment);
      const payment = await paymentRepo.findOneOrFail({ where: { order_id: testOrderId } });
      payment.status = 'captured';
      await paymentRepo.save(payment);

      await expect(
        paymentService.createPaymentAttempt(testOrderId)
      ).rejects.toThrow('Order payment already captured');
    });

    // ── idempotency (sequential re-call while still pending) ───────────────
    it('returns the SAME razorpay_order_id on a sequential second call while payment is pending', async () => {
      const r1 = await paymentService.createPaymentAttempt(testOrderId);
      const r2 = await paymentService.createPaymentAttempt(testOrderId);

      // Both callers must get the same Razorpay order.
      expect(r2.razorpay_order_id).toBe(r1.razorpay_order_id);

      // Razorpay was called exactly once.
      expect(mockRazorpayClient.createOrderCallCount).toBe(1);

      // Database has exactly one attempt row.
      const attempts = await TestDataSource.getRepository(PaymentAttempt).find({
        where: { order_id: testOrderId },
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0].attempt_number).toBe(1);
    });

    // ── legitimate retry after failure ────────────────────────────────────
    it('creates a NEW attempt (with a new Razorpay order) after explicit payment failure', async () => {
      const r1 = await paymentService.createPaymentAttempt(testOrderId);

      // Simulate explicit failure (webhook / admin action sets status = 'failed').
      const paymentRepo = TestDataSource.getRepository(Payment);
      const payment = await paymentRepo.findOneOrFail({ where: { order_id: testOrderId } });
      payment.status = 'failed';
      await paymentRepo.save(payment);

      const r2 = await paymentService.createPaymentAttempt(testOrderId);

      // A new Razorpay order must have been created.
      expect(r2.razorpay_order_id).not.toBe(r1.razorpay_order_id);
      expect(mockRazorpayClient.createOrderCallCount).toBe(2);

      // Two attempt rows with sequential numbers.
      const attempts = await TestDataSource.getRepository(PaymentAttempt).find({
        where: { order_id: testOrderId },
        order: { attempt_number: 'ASC' },
      });
      expect(attempts).toHaveLength(2);
      expect(attempts[0].attempt_number).toBe(1);
      expect(attempts[1].attempt_number).toBe(2);
      expect(attempts[0].razorpay_order_id).toBe(r1.razorpay_order_id);
      expect(attempts[1].razorpay_order_id).toBe(r2.razorpay_order_id);
    });

    // ── CONCURRENCY TEST ─────────────────────────────────────────────────
    /**
     * Two concurrent requests must produce exactly ONE PaymentAttempt row and
     * ONE Razorpay order, and both callers must receive the same rzp order ID.
     *
     * How it works:
     *   Both promises are started before either is awaited.  Because every DB
     *   operation yields to the event loop, PostgreSQL sees interleaved queries
     *   from the two async call stacks.  The UNIQUE(order_id, attempt_number)
     *   constraint + INSERT ON CONFLICT DO NOTHING ensures only one request
     *   wins the reservation.  The other becomes a waiter and polls until the
     *   owner fills in the razorpay_order_id.
     *
     * What this test proves:
     *   - Exactly 1 PaymentAttempt in DB  →  only 1 Razorpay order created.
     *   - Both results carry the same razorpay_order_id.
     *   - mockRazorpayClient.createOrderCallCount === 1.
     */
    it('concurrent duplicate requests produce exactly ONE PaymentAttempt and ONE Razorpay order', async () => {
      // Launch both without awaiting individually — they interleave at I/O points.
      const [r1, r2] = await Promise.all([
        paymentService.createPaymentAttempt(testOrderId),
        paymentService.createPaymentAttempt(testOrderId),
      ]);

      // ── core invariants ─────────────────────────────────────────────────
      // Both callers must see the same Razorpay order ID.
      expect(r1.razorpay_order_id).toBe(r2.razorpay_order_id);

      // Razorpay was called exactly once — no wasted order created.
      expect(mockRazorpayClient.createOrderCallCount).toBe(1);

      // Exactly one PaymentAttempt row in the database.
      const attempts = await TestDataSource.getRepository(PaymentAttempt).find({
        where: { order_id: testOrderId },
        order: { attempt_number: 'ASC' },
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0].attempt_number).toBe(1);
      expect(attempts[0].razorpay_order_id).toBe(r1.razorpay_order_id);
    });

    it('triple-concurrent requests still produce exactly one attempt', async () => {
      const [r1, r2, r3] = await Promise.all([
        paymentService.createPaymentAttempt(testOrderId),
        paymentService.createPaymentAttempt(testOrderId),
        paymentService.createPaymentAttempt(testOrderId),
      ]);

      expect(r1.razorpay_order_id).toBe(r2.razorpay_order_id);
      expect(r2.razorpay_order_id).toBe(r3.razorpay_order_id);
      expect(mockRazorpayClient.createOrderCallCount).toBe(1);

      const attempts = await TestDataSource.getRepository(PaymentAttempt).find({
        where: { order_id: testOrderId },
      });
      expect(attempts).toHaveLength(1);
    });
  });

  // ── verifyPayment ─────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    let rzpOrderId: string;

    beforeEach(async () => {
      const r = await paymentService.createPaymentAttempt(testOrderId);
      rzpOrderId = r.razorpay_order_id;
    });

    it('captures the payment and confirms the order', async () => {
      const paymentId = 'pay_capture_test_1';
      const sig = buildSignature(rzpOrderId, paymentId);

      const result = await paymentService.verifyPayment({
        order_id: testOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      });

      expect(result.status).toBe('captured');
      expect(result.razorpay_payment_id).toBe(paymentId);

      const order = await TestDataSource.getRepository(Order).findOneOrFail({
        where: { id: testOrderId },
      });
      expect(order.status).toBe('confirmed');
    });

    it('rejects an invalid signature', async () => {
      await expect(
        paymentService.verifyPayment({
          order_id: testOrderId,
          razorpay_payment_id: 'pay_bad',
          razorpay_signature: 'not_a_real_sig',
        })
      ).rejects.toThrow('Invalid payment signature');
    });

    it('is idempotent — calling verify twice with the same IDs is safe', async () => {
      const paymentId = 'pay_idem_test_1';
      const sig = buildSignature(rzpOrderId, paymentId);

      const r1 = await paymentService.verifyPayment({
        order_id: testOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      });
      const r2 = await paymentService.verifyPayment({
        order_id: testOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      });

      expect(r2.id).toBe(r1.id);
      expect(r2.razorpay_payment_id).toBe(paymentId);
      expect(r2.status).toBe('captured');

      const payments = await TestDataSource.getRepository(Payment).find({
        where: { order_id: testOrderId },
      });
      expect(payments).toHaveLength(1);
    });

    it('rejects double-capture with a DIFFERENT payment ID', async () => {
      const paymentId1 = 'pay_dcap_1';
      await paymentService.verifyPayment({
        order_id: testOrderId,
        razorpay_payment_id: paymentId1,
        razorpay_signature: buildSignature(rzpOrderId, paymentId1),
      });

      const paymentId2 = 'pay_dcap_2';
      await expect(
        paymentService.verifyPayment({
          order_id: testOrderId,
          razorpay_payment_id: paymentId2,
          razorpay_signature: buildSignature(rzpOrderId, paymentId2),
        })
      ).rejects.toThrow('already captured');
    });

    it('rejects missing required fields', async () => {
      await expect(
        paymentService.verifyPayment({
          order_id: testOrderId,
          razorpay_payment_id: '',
          razorpay_signature: '',
        })
      ).rejects.toThrow('Missing required');
    });

    it('returns 404-equivalent error for an order with no attempt', async () => {
      await expect(
        paymentService.verifyPayment({
          order_id: '00000000-0000-0000-0000-000000000000',
          razorpay_payment_id: 'pay_x',
          razorpay_signature: 'sig_x',
        })
      ).rejects.toThrow('Payment attempt not found for order');
    });

    it('concurrent verify calls for the same payment are idempotent', async () => {
      const paymentId = 'pay_concurrent_verify';
      const sig = buildSignature(rzpOrderId, paymentId);

      const [r1, r2] = await Promise.all([
        paymentService.verifyPayment({
          order_id: testOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
        }),
        paymentService.verifyPayment({
          order_id: testOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
        }),
      ]);

      // Both must resolve to the same captured state.
      expect(r1.status).toBe('captured');
      expect(r2.status).toBe('captured');
      expect(r1.razorpay_payment_id).toBe(paymentId);
      expect(r2.razorpay_payment_id).toBe(paymentId);

      // Only one Payment row.
      const payments = await TestDataSource.getRepository(Payment).find({
        where: { order_id: testOrderId },
      });
      expect(payments).toHaveLength(1);
    });
  });

  // ── getPaymentByOrderId ───────────────────────────────────────────────────

  describe('getPaymentByOrderId', () => {
    it('returns the payment after an attempt is created', async () => {
      await paymentService.createPaymentAttempt(testOrderId);

      const p = await paymentService.getPaymentByOrderId(testOrderId);
      expect(p).not.toBeNull();
      expect(p?.order_id).toBe(testOrderId);
      expect(p?.status).toBe('pending');
      expect(Number(p?.amount_cents)).toBe(100_000);
    });

    it('returns null for an unknown order', async () => {
      const p = await paymentService.getPaymentByOrderId('00000000-0000-0000-0000-000000000000');
      expect(p).toBeNull();
    });
  });

  // ── getLatestPaymentAttempt ───────────────────────────────────────────────

  describe('getLatestPaymentAttempt', () => {
    it('returns the highest attempt_number after a retry', async () => {
      await paymentService.createPaymentAttempt(testOrderId);

      const paymentRepo = TestDataSource.getRepository(Payment);
      const payment = await paymentRepo.findOneOrFail({ where: { order_id: testOrderId } });
      payment.status = 'failed';
      await paymentRepo.save(payment);

      await paymentService.createPaymentAttempt(testOrderId);

      const latest = await paymentService.getLatestPaymentAttempt(testOrderId);
      expect(latest?.attempt_number).toBe(2);
    });

    it('returns null for an unknown order', async () => {
      const a = await paymentService.getLatestPaymentAttempt('00000000-0000-0000-0000-000000000000');
      expect(a).toBeNull();
    });
  });

  // ── RazorpayClient unit tests ─────────────────────────────────────────────

  describe('RazorpayClient.verifySignature', () => {
    it('accepts a correctly computed HMAC signature', () => {
      const client = new RazorpayClient('key', 'my_secret');
      const msg = 'order_ABC|pay_XYZ';
      const sig = crypto.createHmac('sha256', 'my_secret').update(msg).digest('hex');
      expect(client.verifySignature(msg, sig)).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const client = new RazorpayClient('key', 'my_secret');
      expect(client.verifySignature('order_ABC|pay_XYZ', 'bad_sig')).toBe(false);
    });

    it('rejects a signature computed with the wrong secret', () => {
      const client = new RazorpayClient('key', 'my_secret');
      const badSig = crypto.createHmac('sha256', 'wrong_secret').update('order_ABC|pay_XYZ').digest('hex');
      expect(client.verifySignature('order_ABC|pay_XYZ', badSig)).toBe(false);
    });
  });
});
