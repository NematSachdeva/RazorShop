import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type PromiseStatus = 'pending' | 'fulfilled' | 'missed' | 'cancelled';

@Entity('promises_to_pay')
export class PromiseToPay {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recovery_case_id!: string;

  @ManyToOne('RecoveryCase', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recovery_case_id' })
  recovery_case!: any;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne('Customer', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: any;

  @Column({ type: 'uuid' })
  customer_interaction_id!: string;

  @ManyToOne('CustomerInteraction', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_interaction_id' })
  customer_interaction!: any;

  @Column({ type: 'varchar', length: 50 })
  status!: PromiseStatus;

  @Column({ type: 'integer' })
  promised_amount_cents!: number; // Amount in cents promised to pay

  @Column({ type: 'timestamp' })
  promised_deadline!: Date; // Date by which customer promises to pay

  @Column({ type: 'text', nullable: true })
  promise_notes?: string;

  @Column({ type: 'timestamp', nullable: true })
  fulfilled_at?: Date; // When promise was fulfilled (payment received)

  @Column({ type: 'timestamp', nullable: true })
  missed_at?: Date; // When promise deadline was missed

  @Column({ type: 'text', nullable: true })
  outcome_notes?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
