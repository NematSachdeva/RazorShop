import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('payment_attempts')
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
