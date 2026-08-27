import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Product } from './Product.js';
import { Cart } from './Cart.js';

export type RecommendationType =
  | 'product_to_product'
  | 'cart_cross_sell'
  | 'cart_bundle'
  | 'home_page'
  | 'search'
  | 'manual'
  | 'unknown';

export type RecommendationReason =
  | 'similar_category'
  | 'similar_price_range'
  | 'frequently_bought_together'
  | 'completed_outfit'
  | 'budget_friendly'
  | 'premium_alternative'
  | 'seasonal'
  | 'trending'
  | 'customer_favorite'
  | 'unknown';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  product_id?: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ type: 'uuid', nullable: true })
  cart_id?: string;

  @ManyToOne(() => Cart, { nullable: true })
  @JoinColumn({ name: 'cart_id' })
  cart?: Cart;

  @Column({ type: 'varchar', length: 50 })
  recommendation_type!: RecommendationType;

  @Column({ type: 'varchar', length: 50 })
  reason!: RecommendationReason;

  @Column({ type: 'jsonb' })
  recommended_products!: Array<{
    product_id: string;
    score: number;
    reason?: string;
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  reasoning?: {
    explanation: string;
    confidence: number;
    sources: string[];
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    context?: Record<string, unknown>;
    cache_until?: string;
    source?: string;
    prompt_hash?: string;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'integer', default: 0 })
  shown_count!: number;

  @Column({ type: 'integer', default: 0 })
  clicked_count!: number;

  @Column({ type: 'integer', default: 0 })
  added_to_cart_count!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
