import { OrderService } from './OrderService.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';

describe('OrderService', () => {
  let service: OrderService;
  let testCustomerId: string;
  let testProductId: string;
  let testCartId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    service = new OrderService(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Create test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `order-test-${Date.now()}@test.com`,
      name: 'Order Test User',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;

    // Create test product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      description: 'Test product for order',
      price_cents: 50000, // ₹500
      category: 'test',
    });
    const savedProduct = await productRepo.save(product);
    testProductId = savedProduct.id;

    // Create inventory
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const inventory = inventoryRepo.create({
      product_id: testProductId,
      quantity_on_hand: 100,
      reserved: 0,
    });
    await inventoryRepo.save(inventory);

    // Create cart
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = cartRepo.create({
      customer_id: testCustomerId,
      status: 'active',
    });
    const savedCart = await cartRepo.save(cart);
    testCartId = savedCart.id;

    // Add item to cart
    const cartItemRepo = TestDataSource.getRepository(CartItem);
    const cartItem = cartItemRepo.create({
      cart_id: testCartId,
      product_id: testProductId,
      quantity: 2,
      price_cents: 50000,
    });
    await cartItemRepo.save(cartItem);
  });

  describe('createOrderFromCart', () => {
    it('should create order from valid cart', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.customer_id).toBe(testCustomerId);
      expect(order.status).toBe('pending');
      expect(order.items.length).toBe(1);
    });

    it('should create correct OrderItems', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      expect(order.items.length).toBe(1);
      expect(order.items[0].product_id).toBe(testProductId);
      expect(order.items[0].quantity).toBe(2);
    });

    it('should snapshot current product prices', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      expect(Number(order.items[0].price_cents)).toBe(50000);
      expect(Number(order.items[0].line_total_cents)).toBe(100000); // 50000 * 2

      // Now change the product price
      const productRepo = TestDataSource.getRepository(Product);
      const product = await productRepo.findOne({ where: { id: testProductId } });
      if (product) {
        product.price_cents = 60000;
        await productRepo.save(product);
      }

      // Verify order item still has original price
      const retrievedOrder = await service.getOrderById(order.id);
      expect(Number(retrievedOrder?.items[0].price_cents)).toBe(50000);
    });

    it('should calculate subtotal correctly', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      expect(order.subtotal_cents).toBe(100000); // 50000 * 2
    });

    it('should set tax_cents to 0', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      expect(Number(order.tax_cents)).toBe(0);
    });

    it('should set total_cents correctly', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      expect(order.total_cents).toBe(100000); // subtotal + tax (0)
    });

    it('should generate unique order numbers', async () => {
      const order1 = await service.createOrderFromCart(testCartId, testCustomerId);

      // Create another cart for second order
      const cartRepo = TestDataSource.getRepository(Cart);
      const cart2 = cartRepo.create({
        customer_id: testCustomerId,
        status: 'active',
      });
      const savedCart2 = await cartRepo.save(cart2);

      const cartItemRepo = TestDataSource.getRepository(CartItem);
      const cartItem2 = cartItemRepo.create({
        cart_id: savedCart2.id,
        product_id: testProductId,
        quantity: 1,
        price_cents: 50000,
      });
      await cartItemRepo.save(cartItem2);

      const order2 = await service.createOrderFromCart(savedCart2.id, testCustomerId);

      expect(order1.order_number).not.toBe(order2.order_number);
    });

    it('should generate order number in expected format', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      // Format: ORD-YYYYMMDD-NNNNN
      const regex = /^ORD-\d{8}-\d{5}$/;
      expect(order.order_number).toMatch(regex);
    });

    it('should reject empty cart', async () => {
      // Create empty cart
      const cartRepo = TestDataSource.getRepository(Cart);
      const emptyCart = cartRepo.create({
        customer_id: testCustomerId,
        status: 'active',
      });
      const savedEmptyCart = await cartRepo.save(emptyCart);

      try {
        await service.createOrderFromCart(savedEmptyCart.id, testCustomerId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Cannot create order from empty cart');
      }
    });

    it('should reject nonexistent cart', async () => {
      try {
        await service.createOrderFromCart('00000000-0000-0000-0000-000000000000', testCustomerId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Cart not found');
      }
    });

    it('should reject customer/cart ownership mismatch', async () => {
      // Create another customer
      const customerRepo = TestDataSource.getRepository(Customer);
      const otherCustomer = customerRepo.create({
        email: `other-${Date.now()}@test.com`,
      });
      const savedOtherCustomer = await customerRepo.save(otherCustomer);

      try {
        await service.createOrderFromCart(testCartId, savedOtherCustomer.id);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Cart does not belong to this customer');
      }
    });

    it('should reject already converted cart', async () => {
      // Convert cart first time
      await service.createOrderFromCart(testCartId, testCustomerId);

      // Try to convert again
      try {
        await service.createOrderFromCart(testCartId, testCustomerId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('already been converted');
      }
    });

    it('should reject insufficient inventory', async () => {
      // Reduce inventory
      const inventoryRepo = TestDataSource.getRepository(Inventory);
      const inventory = await inventoryRepo.findOne({ where: { product_id: testProductId } });
      if (inventory) {
        inventory.quantity_on_hand = 1;
        await inventoryRepo.save(inventory);
      }

      try {
        await service.createOrderFromCart(testCartId, testCustomerId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Insufficient inventory');
      }
    });

    it('should reserve inventory correctly', async () => {
      await service.createOrderFromCart(testCartId, testCustomerId);

      const inventoryRepo = TestDataSource.getRepository(Inventory);
      const inventory = await inventoryRepo.findOne({ where: { product_id: testProductId } });

      expect(inventory?.reserved).toBe(2);
      expect(inventory?.quantity_on_hand).toBe(100);
    });

    it('should mark cart as converted', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      const cartRepo = TestDataSource.getRepository(Cart);
      const cart = await cartRepo.findOne({ where: { id: testCartId } });

      expect(cart?.status).toBe('converted');
      expect(cart?.converted_to_order_id).toBe(order.id);
    });

    it('should rollback entire transaction if inventory reservation fails', async () => {
      // Create a scenario where inventory fails during reservation
      const inventoryRepo = TestDataSource.getRepository(Inventory);
      const inventory = await inventoryRepo.findOne({ where: { product_id: testProductId } });

      if (inventory) {
        // Set reserved so high that this order cannot fit
        inventory.reserved = 99;
        await inventoryRepo.save(inventory);
      }

      const orderRepo = TestDataSource.getRepository(Order);
      const initialOrderCount = await orderRepo.count();

      try {
        await service.createOrderFromCart(testCartId, testCustomerId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Insufficient inventory');
      }

      // Verify no order was created
      const finalOrderCount = await orderRepo.count();
      expect(finalOrderCount).toBe(initialOrderCount);

      // Verify cart is still active
      const cartRepo = TestDataSource.getRepository(Cart);
      const cart = await cartRepo.findOne({ where: { id: testCartId } });
      expect(cart?.status).toBe('active');
      expect(cart?.converted_to_order_id).toBeNull();
    });
  });

  describe('getOrderById', () => {
    it('should return order with items', async () => {
      const createdOrder = await service.createOrderFromCart(testCartId, testCustomerId);
      const order = await service.getOrderById(createdOrder.id);

      expect(order).toBeDefined();
      expect(order?.id).toBe(createdOrder.id);
      expect(order?.items.length).toBe(1);
    });

    it('should return null for nonexistent order', async () => {
      const order = await service.getOrderById('00000000-0000-0000-0000-000000000000');

      expect(order).toBeNull();
    });
  });

  describe('getOrderByNumber', () => {
    it('should return order by order number', async () => {
      const createdOrder = await service.createOrderFromCart(testCartId, testCustomerId);
      const order = await service.getOrderByNumber(createdOrder.order_number);

      expect(order).toBeDefined();
      expect(order?.id).toBe(createdOrder.id);
      expect(order?.order_number).toBe(createdOrder.order_number);
    });

    it('should return null for nonexistent order number', async () => {
      const order = await service.getOrderByNumber('ORD-99999999-99999');

      expect(order).toBeNull();
    });
  });

  describe('listOrdersByCustomer', () => {
    it('should return orders with pagination', async () => {
      const order = await service.createOrderFromCart(testCartId, testCustomerId);

      const result = await service.listOrdersByCustomer(testCustomerId, 1, 20);

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.pages).toBeGreaterThan(0);
    });

    it('should handle pagination limits', async () => {
      const result = await service.listOrdersByCustomer(testCustomerId, 1, 5);

      expect(result.limit).toBeLessThanOrEqual(100);
      expect(result.page).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Concurrency protection', () => {
    it('should prevent two concurrent orders from same cart', async () => {
      const results: any[] = [];
      const errors: any[] = [];

      // Simulate two concurrent requests
      const promise1 = service
        .createOrderFromCart(testCartId, testCustomerId)
        .then((result) => {
          results.push({ order: result, source: 'promise1' });
        })
        .catch((error) => {
          errors.push({ error, source: 'promise1' });
        });

      const promise2 = service
        .createOrderFromCart(testCartId, testCustomerId)
        .then((result) => {
          results.push({ order: result, source: 'promise2' });
        })
        .catch((error) => {
          errors.push({ error, source: 'promise2' });
        });

      await Promise.all([promise1, promise2]);

      // Either one succeeds and one fails, or both attempts see the cart is already converted
      const successCount = results.length;
      const errorCount = errors.length;

      expect(successCount + errorCount).toBe(2);
      expect(successCount).toBeLessThanOrEqual(1); // At most one should succeed

      if (successCount === 1) {
        // One succeeded, one failed
        expect(errorCount).toBe(1);
        // Could be either "already been converted" or serialization error, both are acceptable
        expect(
          errors[0].error.message.includes('already been converted') ||
            errors[0].error.message.includes('concurrent update')
        ).toBe(true);
      }
    });
  });
});
