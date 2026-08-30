import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

@Entity('merchant_applications')
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @Column({ type: 'uuid', nullable: true })
  merchant_id?: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar' })
  business_name!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: ApplicationStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submitted_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at?: Date;

  @Column({ type: 'varchar', nullable: true })
  reviewer_id?: string;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
