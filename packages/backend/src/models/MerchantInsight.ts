import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Merchant } from './Merchant.js';

export type InsightType =
  | 'payment_failure_patterns'
  | 'abandoned_cart_patterns'
  | 'recovery_success_rates'
  | 'product_bundles'
  | 'discount_strategy'
  | 'inventory_optimization'
  | 'recovery_targeting';

@Entity('merchant_insights')
export class MerchantInsight {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  merchant_id!: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @Column({ type: 'varchar', length: 50 })
  type!: InsightType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'jsonb' })
  insights!: Array<{
    title: string;
    description: string;
    reasoning: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
    confidence_percent: number;
    data_sources: string[];
    limitations?: string;
  }>;

  @Column({ type: 'jsonb' })
  data_summary!: Record<string, unknown>;

  @Column({ type: 'integer', default: 70 })
  confidence_percent!: number;

  @Column({ type: 'jsonb', nullable: true })
  guard_rails_applied?: string[];

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  read_at?: Date;
}
