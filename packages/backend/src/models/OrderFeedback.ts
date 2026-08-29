import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export type FeedbackCategory =
  | 'Payment'
  | 'Product'
  | 'Checkout'
  | 'Delivery'
  | 'Overall Experience';

@Entity('order_feedbacks')
@Index(['customer_id'])
export class OrderFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  order_id!: string;

  @ManyToOne('Order', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: any;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne('Customer', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: any;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'varchar', length: 50, default: 'Overall Experience' })
  category!: FeedbackCategory;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
