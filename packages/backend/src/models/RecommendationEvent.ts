import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Recommendation } from './Recommendation.js';
import { Product } from './Product.js';
import { Order } from './Order.js';
import { Customer } from './Customer.js';

export type RecommendationEventType =
  | 'shown' // Recommendation displayed to user
  | 'clicked' // User clicked on recommendation
  | 'added_to_cart' // User added recommended product to cart
  | 'purchased' // User purchased recommended product (from order)
  | 'viewed_product' // User viewed the recommended product page
  | 'removed_from_cart' // User removed recommended product from cart
  | 'ignored'; // User scrolled past without interaction

@Entity('recommendation_events')
export class RecommendationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recommendation_id!: string;

  @ManyToOne(() => Recommendation)
  @JoinColumn({ name: 'recommendation_id' })
  recommendation!: Recommendation;

  @Column({ type: 'uuid', nullable: true })
  product_id?: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ type: 'varchar', length: 50 })
  event_type!: RecommendationEventType;

  // Customer/session context
  @Column({ type: 'uuid', nullable: true })
  customer_id?: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  // Order context (for purchase attribution)
  @Column({ type: 'uuid', nullable: true })
  order_id?: string;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  // Metadata for additional context
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    // Time on page before interaction (ms)
    time_on_page_ms?: number;
    // Position in recommendation list
    position?: number;
    // Referrer
    referrer?: string;
    // Device type
    device_type?: 'mobile' | 'tablet' | 'desktop';
    // Browser
    browser?: string;
    // Any other relevant context
    [key: string]: unknown;
  } | null;

  @CreateDateColumn()
  created_at!: Date;
}
