import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type PaymentStatus = 'initiated' | 'pending' | 'captured' | 'failed' | 'refunded';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne('Order', 'payments')
  @JoinColumn({ name: 'order_id' })
  order!: any;

  @Column({ type: 'varchar', nullable: true })
  razorpay_payment_id?: string;

  @Column({ type: 'varchar', nullable: true })
  razorpay_signature?: string;

  @Column({ type: 'varchar', default: 'initiated' })
  status!: PaymentStatus;

  @Column({ type: 'bigint' })
  amount_cents!: number;

  @Column({ type: 'text', nullable: true })
  failure_reason?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
