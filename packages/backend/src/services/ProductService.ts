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

    // Apply category filter
    if (query.category) {
      q = q.where('product.category = :category', { category: query.category });
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
    const data = await q.skip(skip).take(limit).getMany();

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.getRepository().findOne({ where: { id } });
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.getRepository().find({
      where: ids.map((id) => ({ id })),
    });
  }

  async getCategories(): Promise<string[]> {
    const results = await this.getRepository()
      .createQueryBuilder('product')
      .select('DISTINCT product.category', 'category')
      .where('product.category IS NOT NULL')
      .orderBy('product.category', 'ASC')
      .getRawMany();

    return results.map((r) => r.category).filter((c) => c !== null);
  }
}

export const productService = new ProductService();
