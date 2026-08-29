import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer.js';

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'abandoned' | 'converted';

  @OneToMany('CartItem', 'cart', { cascade: true })
  items!: any[];

  @Column({ type: 'uuid', nullable: true })
  converted_to_order_id?: string;

  @Column({ type: 'uuid', nullable: true })
  bundle_recommendation_id?: string;

  @Column({ type: 'integer', default: 0 })
  discount_percent!: number;

  @Column({ type: 'bigint', default: 0 })
  discount_cents!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
