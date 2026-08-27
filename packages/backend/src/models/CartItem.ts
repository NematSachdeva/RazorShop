import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cart_id!: string;

  @ManyToOne('Cart', 'items')
  @JoinColumn({ name: 'cart_id' })
  cart!: any;

  @Column({ type: 'uuid' })
  product_id!: string;

  @ManyToOne('Product')
  @JoinColumn({ name: 'product_id' })
  product!: any;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'bigint' })
  price_cents!: number; // snapshot of product price at time of add

  @CreateDateColumn()
  created_at!: Date;
}
