import { CartService } from './CartService.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';

describe('CartService', () => {
  let service: CartService;
  let testCustomerId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    service = new CartService(TestDataSource);

    // Create a test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `cart-test-${Date.now()}@test.com`,
      name: 'Cart Test User',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should create a cart', async () => {
    const cart = await service.createCart(testCustomerId);
    expect(cart.id).toBeDefined();
    expect(cart.customer_id).toBe(testCustomerId);
    expect(cart.status).toBe('active');
  });

  it('should get cart by ID', async () => {
    const newCart = await service.createCart(testCustomerId);
    const retrieved = await service.getCartById(newCart.id);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(newCart.id);
  });

  it('should return null for non-existent cart', async () => {
    const cart = await service.getCartById('00000000-0000-0000-0000-000000000000');
    expect(cart).toBeNull();
  });

  it('should add product to cart', async () => {
    const newCart = await service.createCart(testCustomerId);
    
    // Get a product to add
    const productRepo = TestDataSource.getRepository('Product');
    const product = await productRepo.findOne({ where: {} });
    
    if (product) {
      const updatedCart = await service.addToCart(newCart.id, product.id, 2);
      expect(updatedCart.items.length).toBe(1);
      expect(updatedCart.items[0].quantity).toBe(2);
      expect(updatedCart.subtotal_cents).toBeGreaterThan(0);
    }
  });

  it('should reject adding product that does not exist', async () => {
    const newCart = await service.createCart(testCustomerId);
    
    try {
      await service.addToCart(newCart.id, '00000000-0000-0000-0000-000000000000', 1);
      fail('Should have thrown error');
    } catch (error) {
      expect((error as Error).message).toBe('Product not found');
    }
  });

  it('should reject invalid quantity', async () => {
    const newCart = await service.createCart(testCustomerId);
    const productRepo = TestDataSource.getRepository('Product');
    const product = await productRepo.findOne({ where: {} });
    
    if (product) {
      try {
        await service.addToCart(newCart.id, product.id, 0);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Quantity must be greater than 0');
      }
    }
  });

  it('should update cart item quantity', async () => {
    const newCart = await service.createCart(testCustomerId);
    const productRepo = TestDataSource.getRepository('Product');
    const product = await productRepo.findOne({ where: {} });
    
    if (product) {
      await service.addToCart(newCart.id, product.id, 2);
      const updated = await service.updateCartItemQuantity(newCart.id, product.id, 5);
      expect(updated.items[0].quantity).toBe(5);
    }
  });

  it('should remove product from cart by setting quantity to 0', async () => {
    const newCart = await service.createCart(testCustomerId);
    const productRepo = TestDataSource.getRepository('Product');
    const product = await productRepo.findOne({ where: {} });
    
    if (product) {
      await service.addToCart(newCart.id, product.id, 1);
      const updated = await service.updateCartItemQuantity(newCart.id, product.id, 0);
      expect(updated.items.length).toBe(0);
    }
  });

  it('should clear cart', async () => {
    const newCart = await service.createCart(testCustomerId);
    const productRepo = TestDataSource.getRepository('Product');
    const products = await productRepo.find({ skip: 0, take: 2 });
    
    for (const product of products) {
      await service.addToCart(newCart.id, product.id, 1);
    }
    
    const cleared = await service.clearCart(newCart.id);
    expect(cleared.items.length).toBe(0);
  });

  it('should calculate totals correctly', async () => {
    const newCart = await service.createCart(testCustomerId);
    const productRepo = TestDataSource.getRepository('Product');
    const product = await productRepo.findOne({ where: {} });
    
    if (product) {
      const qty = 3;
      const updated = await service.addToCart(newCart.id, product.id, qty);
      const expectedTotal = product.price_cents * qty;
      expect(updated.total_cents).toBe(expectedTotal);
    }
  });
});
