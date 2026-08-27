import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './Product.js';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  product_id!: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'integer', default: 0 })
  quantity_on_hand: number = 0;

  @Column({ type: 'integer', default: 0 })
  reserved: number = 0;

  @UpdateDateColumn()
  last_updated!: Date;
}
