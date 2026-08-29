import { AppDataSource } from '../config/database.js';
import { DataSource } from 'typeorm';
import { Product } from '../models/Product.js';

export interface ProductListQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest';
  includeTestFixtures?: boolean;
}

export interface ProductListResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export class ProductService {
  constructor(private dataSource: DataSource = AppDataSource) {}

  private getRepository() {
    return this.dataSource.getRepository(Product);
  }

  async listProducts(query: ProductListQuery): Promise<ProductListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    let q = this.getRepository().createQueryBuilder('product');

    // Exclude test fixture products & archived products from customer catalog by default
    if (!query.includeTestFixtures) {
      q = q.where(
        "product.name NOT ILIKE :testPattern AND (product.category IS NULL OR (product.category != 'test' AND product.category != 'archived'))",
        { testPattern: 'Test Product%' }
      );
    } else {
      q = q.where("(product.category IS NULL OR product.category != 'archived')");
    }

    // Apply category filter
    if (query.category) {
      q = q.andWhere('product.category = :category', { category: query.category });
    }

    // Apply search filter
    if (query.search) {
      const searchTerm = `%${query.search}%`;
      q = q.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: searchTerm }
      );
    }

    // Apply price range filter
    if (query.minPrice !== undefined) {
      q = q.andWhere('product.price_cents >= :minPrice', { minPrice: query.minPrice * 100 });
    }
    if (query.maxPrice !== undefined) {
      q = q.andWhere('product.price_cents <= :maxPrice', { maxPrice: query.maxPrice * 100 });
    }

    // Apply sorting
    switch (query.sort) {
      case 'price_asc':
        q = q.orderBy('product.price_cents', 'ASC');
        break;
      case 'price_desc':
        q = q.orderBy('product.price_cents', 'DESC');
        break;
      case 'name_asc':
        q = q.orderBy('product.name', 'ASC');
        break;
      case 'name_desc':
        q = q.orderBy('product.name', 'DESC');
        break;
      case 'newest':
      default:
        q = q.orderBy('product.created_at', 'DESC');
    }

    // Count total
    const total = await q.getCount();

    // Get paginated results
    const products = await q.skip(skip).take(limit).getMany();

    const inventoryRepo = this.dataSource.getRepository('Inventory');
    const data = [];
    for (const p of products) {
      const inv: any = await inventoryRepo.findOne({ where: { product_id: p.id } });
      const qOnHand = inv?.quantity_on_hand || 0;
      const qReserved = inv?.reserved || 0;
      data.push({
        ...p,
        price_cents: Number(p.price_cents),
        inventory: {
          quantity_on_hand: qOnHand,
          reserved: qReserved,
          available: Math.max(0, qOnHand - qReserved),
        },
      });
    }

    return {
      data: data as any,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    const p = await this.getRepository().findOne({ where: { id } });
    if (!p) return null;
    const inventoryRepo = this.dataSource.getRepository('Inventory');
    const inv: any = await inventoryRepo.findOne({ where: { product_id: p.id } });
    const qOnHand = inv?.quantity_on_hand || 0;
    const qReserved = inv?.reserved || 0;
    return {
      ...p,
      price_cents: Number(p.price_cents),
      inventory: {
        quantity_on_hand: qOnHand,
        reserved: qReserved,
        available: Math.max(0, qOnHand - qReserved),
      },
    } as any;
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.getRepository().find({
      where: ids.map((id) => ({ id })),
    });
  }

  async getCategories(includeTestFixtures: boolean = false): Promise<string[]> {
    let q = this.getRepository()
      .createQueryBuilder('product')
      .select('DISTINCT product.category', 'category')
      .where('product.category IS NOT NULL');

    if (!includeTestFixtures) {
      q = q.andWhere("product.category != 'test' AND product.name NOT ILIKE :testPattern", { testPattern: 'Test Product%' });
    }

    const results = await q.orderBy('product.category', 'ASC').getRawMany();

    return results.map((r) => r.category).filter((c) => c !== null);
  }
}

export const productService = new ProductService();
