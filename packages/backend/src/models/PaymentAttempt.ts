import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

@Entity('payment_attempts')
@Unique('uk_payment_attempts_order_attempt', ['order_id', 'attempt_number'])
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne('Order')
  @JoinColumn({ name: 'order_id' })
  order!: any;

  @Column({ type: 'varchar', nullable: true })
  razorpay_order_id?: string;

  @Column({ type: 'integer', default: 1 })
  attempt_number!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
