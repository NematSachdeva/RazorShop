import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer.js';
import { OrderItem } from './OrderItem.js';
import { Payment } from './Payment.js';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dispatched'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'pickup_scheduled'
  | 'order_picked_up'
  | 'return_in_transit'
  | 'order_returned_to_seller'
  | 'refund_initiated';

export interface ShippingAddressSnapshot {
  full_address: string;
  state: string;
  pin_code: string;
  phone?: string;
  name?: string;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'varchar', unique: true })
  order_number!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: OrderStatus;

  @Column({ type: 'jsonb', nullable: true })
  shipping_address?: ShippingAddressSnapshot | null;

  @Column({ type: 'bigint' })
  subtotal_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  tax_cents!: number;

  @Column({ type: 'bigint', default: 0 })
  discount_cents!: number;

  @Column({ type: 'bigint' })
  total_cents!: number;

  @Column({ type: 'text', nullable: true })
  cancellation_reason?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  cancellation_timestamp?: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cancelled_by?: 'customer' | 'merchant' | 'system' | null;

  @Column({ type: 'bigint', nullable: true })
  refund_amount_cents?: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  refund_status?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  return_status?: string | null;

  @Column({ type: 'text', nullable: true })
  return_reason?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  return_requested_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  return_approved_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  return_rejected_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  return_rejection_reason?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  pickup_scheduled_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  pickup_notes?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  picked_up_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  return_in_transit_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  returned_to_seller_at?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  refund_initiated_at?: Date | null;

  @OneToMany('OrderItem', 'order', { cascade: true })
  items!: OrderItem[];

  @OneToMany('Payment', 'order', { cascade: true })
  payments!: Payment[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
