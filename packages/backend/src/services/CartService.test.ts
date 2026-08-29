import { CartService } from './CartService.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';

describe('CartService', () => {
  let service: CartService;
  let testCustomerId: string;
  let testProductId: string;

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

    // Create a test product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      description: 'Test product for cart',
      price_cents: 50000, // ₹500
      category: 'test',
    });
    const savedProduct = await productRepo.save(product);
    testProductId = savedProduct.id;

    // Create inventory for the product
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const inventory = inventoryRepo.create({
      product_id: testProductId,
      quantity_on_hand: 100,
      reserved: 0,
    });
    await inventoryRepo.save(inventory);
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
    const updatedCart = await service.addToCart(newCart.id, testProductId, 2);
    expect(updatedCart.items.length).toBe(1);
    expect(updatedCart.items[0].quantity).toBe(2);
    expect(updatedCart.subtotal_cents).toBeGreaterThan(0);
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
    
    try {
      await service.addToCart(newCart.id, testProductId, 0);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Quantity must be greater than 0');
      }
  });

  it('should update cart item quantity', async () => {
    const newCart = await service.createCart(testCustomerId);
    await service.addToCart(newCart.id, testProductId, 2);
    const updated = await service.updateCartItemQuantity(newCart.id, testProductId, 5);
    expect(updated.items[0].quantity).toBe(5);
  });

  it('should remove product from cart by setting quantity to 0', async () => {
    const newCart = await service.createCart(testCustomerId);
    await service.addToCart(newCart.id, testProductId, 1);
    const updated = await service.updateCartItemQuantity(newCart.id, testProductId, 0);
    expect(updated.items.length).toBe(0);
  });

  it('should clear cart', async () => {
    const newCart = await service.createCart(testCustomerId);
    await service.addToCart(newCart.id, testProductId, 1);
    
    const cleared = await service.clearCart(newCart.id);
    expect(cleared.items.length).toBe(0);
  });

  it('should calculate totals correctly', async () => {
    const newCart = await service.createCart(testCustomerId);
    const product = await TestDataSource.getRepository(Product).findOne({ where: { id: testProductId } });
    
    if (product) {
      const qty = 3;
      const updated = await service.addToCart(newCart.id, testProductId, qty);
      const expectedTotal = product.price_cents * qty;
      expect(updated.total_cents).toBe(expectedTotal);
    }
  });
});
