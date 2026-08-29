import { ProductService } from './ProductService.js';
import { initializeTestDatabase, closeTestDatabase, TestDataSource } from '../config/database.test.js';

describe('ProductService', () => {
  let service: ProductService;

  beforeAll(async () => {
    await initializeTestDatabase();
    service = new ProductService(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should list products with default pagination', async () => {
    const result = await service.listProducts({ includeTestFixtures: true });
    expect(result.data).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should support pagination', async () => {
    const result1 = await service.listProducts({ page: 1, limit: 10, includeTestFixtures: true });
    const result2 = await service.listProducts({ page: 2, limit: 10, includeTestFixtures: true });

    expect(result1.data.length).toBeLessThanOrEqual(10);
    expect(result2.data.length).toBeLessThanOrEqual(10);
    expect(result1.data).not.toEqual(result2.data);
  });

  it('should filter by category', async () => {
    const result = await service.listProducts({ category: 'Electronics', includeTestFixtures: true });
    
    if (result.data.length > 0) {
      result.data.forEach((product) => {
        expect(product.category).toBe('Electronics');
      });
    }
  });

  it('should search by name and description', async () => {
    const result = await service.listProducts({ search: 'keyboard', includeTestFixtures: true });
    
    if (result.data.length > 0) {
      result.data.forEach((product) => {
        const searchableText = `${product.name} ${product.description || ''}`  .toLowerCase();
        expect(searchableText).toContain('keyboard');
      });
    }
  });

  it('should sort by price ascending', async () => {
    const result = await service.listProducts({ sort: 'price_asc', limit: 50, includeTestFixtures: true });
    
    if (result.data.length > 1) {
      for (let i = 1; i < result.data.length; i++) {
        const prev = Number(result.data[i - 1].price_cents);
        const current = Number(result.data[i].price_cents);
        expect(current).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it('should sort by price descending', async () => {
    const result = await service.listProducts({ sort: 'price_desc', limit: 50, includeTestFixtures: true });
    
    if (result.data.length > 1) {
      for (let i = 1; i < result.data.length; i++) {
        const prev = Number(result.data[i - 1].price_cents);
        const current = Number(result.data[i].price_cents);
        expect(current).toBeLessThanOrEqual(prev);
      }
    }
  });

  it('should filter by price range', async () => {
    const result = await service.listProducts({ minPrice: 100, maxPrice: 500, includeTestFixtures: true });
    
    if (result.data.length > 0) {
      result.data.forEach((product) => {
        const price = Number(product.price_cents);
        expect(price).toBeGreaterThanOrEqual(10000); // 100 * 100
        expect(price).toBeLessThanOrEqual(50000); // 500 * 100
      });
    }
  });

  it('should get product by ID', async () => {
    const list = await service.listProducts({ limit: 1, includeTestFixtures: true });
    if (list.data.length > 0) {
      const product = await service.getProductById(list.data[0].id);
      expect(product).toBeDefined();
      expect(product?.id).toBe(list.data[0].id);
    }
  });

  it('should return null for non-existent product', async () => {
    const product = await service.getProductById('00000000-0000-0000-0000-000000000000');
    expect(product).toBeNull();
  });

  it('should get categories', async () => {
    const categories = await service.getCategories(true);
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });
});
