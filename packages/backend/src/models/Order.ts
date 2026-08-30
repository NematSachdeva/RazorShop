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

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'shipped' | 'delivered' | 'cancelled';

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

  @OneToMany('OrderItem', 'order', { cascade: true })
  items!: OrderItem[];

  @OneToMany('Payment', 'order', { cascade: true })
  payments!: Payment[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
