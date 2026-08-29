import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Merchant } from './Merchant.js';

@Entity('merchant_configs')
export class MerchantConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  merchant_id!: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  // Guard rails: recovery behavior limits
  @Column({ type: 'integer', default: 3 })
  max_recovery_attempts!: number;

  @Column({ type: 'integer', default: 30 })
  max_discount_percent!: number;

  @Column({ type: 'jsonb', default: '["email", "sms"]' })
  allowed_channels!: string[];

  @Column({ type: 'boolean', default: false })
  allow_partial_refund!: boolean;

  @Column({ type: 'integer', default: 50 })
  max_refund_percent!: number;

  // Customer opt-out tracking
  @Column({ type: 'jsonb', default: '[]' })
  customer_opt_outs!: string[]; // Array of customer UUIDs opted out of recovery

  // Recovery rules
  @Column({ type: 'boolean', default: true })
  auto_retry_enabled!: boolean;

  @Column({ type: 'integer', default: 24 })
  retry_delay_hours!: number;

  @Column({ type: 'boolean', default: true })
  ai_diagnosis_enabled!: boolean;

  // Promise-to-pay settings (M6)
  @Column({ type: 'integer', default: 30 })
  max_promise_days!: number; // Maximum days for a promise-to-pay deadline

  // M8 AI insights configuration
  @Column({ type: 'boolean', default: true })
  ai_insights_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  bundle_recommendations_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  discount_strategy_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  inventory_opt_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  recovery_targeting_enabled!: boolean;

  @Column({ type: 'integer', default: 70, comment: 'Minimum confidence % for insights (0-100)' })
  min_confidence_score!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
