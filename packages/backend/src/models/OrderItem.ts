import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('order_items')
@Unique(['order_id', 'product_id'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne('Order', 'items')
  @JoinColumn({ name: 'order_id' })
  order!: any;

  @Column({ type: 'uuid' })
  product_id!: string;

  @ManyToOne('Product')
  @JoinColumn({ name: 'product_id' })
  product!: any;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'bigint' })
  price_cents!: number; // snapshot of product price at time of order

  @Column({ type: 'bigint' })
  line_total_cents!: number; // quantity * price_cents

  @CreateDateColumn()
  created_at!: Date;
}
