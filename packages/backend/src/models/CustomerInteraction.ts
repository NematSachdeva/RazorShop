import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type CustomerIntentType = 'accepted' | 'refused' | 'promised' | 'unclear';

export type InteractionChannel = 'email' | 'in_app' | 'whatsapp' | 'sms';

@Entity('customer_interactions')
export class CustomerInteraction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recovery_case_id!: string;

  @ManyToOne('RecoveryCase', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recovery_case_id' })
  recovery_case!: any;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne('Customer', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: any;

  @Column({ type: 'varchar', length: 50 })
  channel!: InteractionChannel;

  @Column({ type: 'varchar', length: 50 })
  intent!: CustomerIntentType;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    source?: string;
    device?: string;
    ip_address?: string;
    user_agent?: string;
    [key: string]: unknown;
  } | null;

  @CreateDateColumn()
  created_at!: Date;
}
