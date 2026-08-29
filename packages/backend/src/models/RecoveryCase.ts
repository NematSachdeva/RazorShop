import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

import { PaymentFailure } from './PaymentFailure.js';
import { Order } from './Order.js';
import { Customer } from './Customer.js';

export type RecoveryCaseStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'abandoned'
  | 'customer_declined';

@Entity('recovery_cases')
export class RecoveryCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  payment_failure_id!: string;

  @ManyToOne(() => PaymentFailure, (pf) => pf.recovery_cases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_failure_id' })
  payment_failure!: PaymentFailure;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'varchar', length: 50 })
  status!: RecoveryCaseStatus;

  @Column({ type: 'integer', default: 0 })
  recovery_attempts!: number;

  @Column({ type: 'integer', default: 0 })
  max_recovery_attempts!: number;

  @Column({ type: 'text', nullable: true })
  recovery_notes?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at?: Date;

  @OneToMany('RecoveryAction', 'recovery_case', { cascade: true })
  recovery_actions!: any[];

  @OneToMany('AgentDecision', 'recovery_case', { cascade: true })
  agent_decisions!: any[];
}
