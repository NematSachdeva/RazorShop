import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type RecoveryActionType =
  | 'email_reminder'
  | 'sms_reminder'
  | 'discount_offer'
  | 'partial_refund'
  | 'retry_payment'
  | 'escalate_to_merchant'
  | 'customer_outreach';

export type RecoveryActionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

@Entity('recovery_actions')
export class RecoveryAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recovery_case_id!: string;

  @ManyToOne('RecoveryCase', 'recovery_actions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recovery_case_id' })
  recovery_case!: any;

  @Column({ type: 'varchar', length: 50 })
  action_type!: RecoveryActionType;

  @Column({ type: 'varchar', length: 50 })
  status!: RecoveryActionStatus;

  @Column({ type: 'jsonb', nullable: true })
  action_details?: {
    discount_percent?: number;
    retry_count?: number;
    channel?: string;
    template_id?: string;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'text', nullable: true })
  result?: string;

  @Column({ type: 'boolean', default: false })
  success!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  executed_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;
}
