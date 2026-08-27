import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

import { Payment } from './Payment.js';

export type FailureReason =
  | 'insufficient_funds'
  | 'card_declined'
  | 'expired_card'
  | 'network_error'
  | 'gateway_error'
  | 'timeout'
  | 'authentication_failed'
  | 'unknown';

@Entity('payment_failures')
export class PaymentFailure {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  payment_id!: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  @Column({ type: 'varchar', length: 50 })
  reason!: FailureReason;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'jsonb', nullable: true })
  error_context?: {
    code?: string;
    message?: string;
    gateway_response?: unknown;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'integer', default: 1 })
  failure_count!: number;

  @Column({ type: 'timestamp', nullable: true })
  last_failure_at?: Date;

  @CreateDateColumn()
  detected_at!: Date;

  @OneToMany('RecoveryCase', 'payment_failure', { cascade: true })
  recovery_cases!: any[];
}
