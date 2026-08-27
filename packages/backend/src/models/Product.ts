import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from './Merchant.js';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'bigint' }) // cents
  price_cents!: number;

  @Column({ type: 'varchar', nullable: true })
  category?: string;

  @Column({ type: 'uuid', nullable: true })
  merchant_id?: string;

  @ManyToOne(() => Merchant, { nullable: true })
  @JoinColumn({ name: 'merchant_id' })
  merchant?: Merchant;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
