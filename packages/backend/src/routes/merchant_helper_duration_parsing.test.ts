import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { MerchantHelperService } from '../services/MerchantHelperService.js';
import { Merchant } from '../models/Merchant.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';

describe('Merchant Helper Natural Language Duration Parsing (English, Hindi, Hinglish)', () => {
  let helperService: MerchantHelperService;
  let merchant: Merchant;
  let customer: Customer;
  let product: Product;
  let cart: Cart;

  beforeAll(async () => {
    await initializeTestDatabase();
    helperService = new MerchantHelperService(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
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
    const cartRepo = TestDataSource.getRepository(Cart);
    const cartItemRepo = TestDataSource.getRepository(CartItem);

    merchant = await merchantRepo.save(
      merchantRepo.create({
        id: '11111111-1111-1111-1111-111111111111',
        email: `merchant-dur-${Date.now()}@domain.com`,
        name: 'Duration Test Merchant',
        status: 'active',
      })
    );

    customer = await customerRepo.save(
      customerRepo.create({
        email: `cust-dur-${Date.now()}@domain.com`,
        name: 'Duration Test Customer',
      })
    );

    product = await productRepo.save(
      productRepo.create({
        merchant_id: merchant.id,
        name: 'Power Bank',
        description: 'Portable power bank',
        price_cents: 99900,
        category: 'Gadgets',
      })
    );

    // Create an abandoned cart (updated 10 minutes ago)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    cart = await cartRepo.save(
      cartRepo.create({
        customer_id: customer.id,
        status: 'abandoned',
        created_at: tenMinsAgo,
        updated_at: tenMinsAgo,
      })
    );

    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: cart.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 99900,
      })
    );
  });

  describe('Direct parseDuration Unit Verification', () => {
    it('1. Parses "एक घंटे का" -> 1 hour (60 mins)', () => {
      const dur = helperService.parseDuration('इस प्रोडक्ट पे 50% OFF की डील दे दो और टाइमर लगा दो एक घंटे का मेल कर दो उन्हें');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(1);
      expect(dur?.durationUnit).toBe('hours');
      expect(dur?.expiresInMinutes).toBe(60);
    });

    it('2. Parses "एक घंटे के लिए" -> 1 hour (60 mins)', () => {
      const dur = helperService.parseDuration('50% off do, एक घंटे के लिए');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(1);
      expect(dur?.durationUnit).toBe('hours');
      expect(dur?.expiresInMinutes).toBe(60);
    });

    it('3. Parses "एक घंटा" -> 1 hour (60 mins)', () => {
      const dur = helperService.parseDuration('एक घंटा तक 50% off discount de do');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(1);
      expect(dur?.durationUnit).toBe('hours');
      expect(dur?.expiresInMinutes).toBe(60);
    });

    it('4. Parses "दो घंटे" -> 2 hours (120 mins)', () => {
      const dur = helperService.parseDuration('50% off do, दो घंटे के लिए');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(2);
      expect(dur?.durationUnit).toBe('hours');
      expect(dur?.expiresInMinutes).toBe(120);
    });

    it('5. Parses "30 मिनट" -> 30 minutes (30 mins)', () => {
      const dur = helperService.parseDuration('50% off do, 30 मिनट के लिए');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(30);
      expect(dur?.durationUnit).toBe('minutes');
      expect(dur?.expiresInMinutes).toBe(30);
    });

    it('6. Parses "पाँच मिनट" -> 5 minutes (5 mins)', () => {
      const dur = helperService.parseDuration('50% discount do पांच मिनट के लिए');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(5);
      expect(dur?.durationUnit).toBe('minutes');
      expect(dur?.expiresInMinutes).toBe(5);
    });

    it('7. Parses "5 minute mein expire" -> 5 minutes (5 mins)', () => {
      const dur = helperService.parseDuration('50% off do, 5 minute mein expire');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(5);
      expect(dur?.durationUnit).toBe('minutes');
      expect(dur?.expiresInMinutes).toBe(5);
    });

    it('8. Parses "1 hour" -> 1 hour (60 mins)', () => {
      const dur = helperService.parseDuration('50% OFF का offer लगाके deal 1 hour में close करनी है');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(1);
      expect(dur?.durationUnit).toBe('hours');
      expect(dur?.expiresInMinutes).toBe(60);
    });

    it('9. Parses "2 days" -> 2 days (2880 mins)', () => {
      const dur = helperService.parseDuration('Give 20% discount valid for 2 days');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(2);
      expect(dur?.durationUnit).toBe('days');
      expect(dur?.expiresInMinutes).toBe(2880);
    });

    it('10. Parses "दो दिन" -> 2 days (2880 mins)', () => {
      const dur = helperService.parseDuration('50% off offer दो दिन तक रखो');
      expect(dur).not.toBeNull();
      expect(dur?.durationValue).toBe(2);
      expect(dur?.durationUnit).toBe('days');
      expect(dur?.expiresInMinutes).toBe(2880);
    });

    it('11. Deal request with NO duration preserves default behavior (2 days)', async () => {
      const response = await helperService.processChatMessage(
        merchant.id,
        'Give 50% discount to abandoned cart'
      );

      expect(response.proposal).not.toBeNull();
      expect(response.proposal?.durationValue).toBe(2);
      expect(response.proposal?.durationUnit).toBe('days');
      expect(response.proposal?.expiresInMinutes).toBe(2880);
    });

    it('12. Request with explicit Hindi/Hinglish duration MUST NOT fall back to 2 days', async () => {
      const response = await helperService.processChatMessage(
        merchant.id,
        'abandoned cart ko 50% discount de do ek ghante ke liye'
      );

      expect(response.proposal).not.toBeNull();
      expect(response.proposal?.durationValue).toBe(1);
      expect(response.proposal?.durationUnit).toBe('hours');
      expect(response.proposal?.expiresInMinutes).toBe(60);
    });

    it('13. Full deal proposal: "इस abandoned cart पे 50% off की deal लगाके एक घंटे का timer लगाके mail करो"', async () => {
      const userMsg = 'इस abandoned cart पे 50% off की deal लगाके एक घंटे का timer लगाके mail करो';
      const response = await helperService.processChatMessage(merchant.id, userMsg);

      expect(response.proposal).not.toBeNull();
      expect(response.proposal?.discountPercent).toBe(50);
      expect(response.proposal?.durationValue).toBe(1);
      expect(response.proposal?.durationUnit).toBe('hours');
      expect(response.proposal?.expiresInMinutes).toBe(60);
    });
  });
});
