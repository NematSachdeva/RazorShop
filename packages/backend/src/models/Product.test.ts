import { Product } from './Product.js';

describe('Product Model', () => {
  it('should create a product with valid data', () => {
    const product = new Product();
    product.id = '123';
    product.name = 'Test Product';
    product.description = 'A test product';
    product.price_cents = 99900;
    product.category = 'Electronics';

    expect(product.name).toBe('Test Product');
    expect(product.price_cents).toBe(99900);
    expect(product.category).toBe('Electronics');
  });

  it('should store price as integer cents (not float)', () => {
    const product = new Product();
    product.price_cents = 1999900; // ₹19,999.00

    expect(typeof product.price_cents).toBe('number');
    expect(Number.isInteger(product.price_cents)).toBe(true);
  });

  it('should allow nullable description and category', () => {
    const product = new Product();
    product.name = 'Minimal Product';
    product.price_cents = 50000;

    expect(product.description).toBeUndefined();
    expect(product.category).toBeUndefined();
  });
});
