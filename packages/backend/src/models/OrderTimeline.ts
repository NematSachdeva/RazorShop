import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './Order.js';

export type OrderTimelineEventType = 'ORDER_CONFIRMED' | 'ORDER_DISPATCHED' | 'ORDER_DELIVERED';

@Entity('order_timeline')
@Index(['order_id'])
@Index(['created_at'])
export class OrderTimeline {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'varchar', length: 50 })
  event_type!: OrderTimelineEventType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actor_id?: string;

  @Column({ type: 'varchar', length: 20, default: 'system' })
  actor_role!: 'customer' | 'merchant' | 'system' | 'admin';

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  created_at!: Date;
}
