import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export type WebhookEventStatus = 'pending' | 'processing' | 'processed' | 'failed';

@Entity('webhook_events')
@Unique(['webhook_id'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  webhook_id!: string; // Razorpay webhook_id or deterministic event identifier

  @Column({ type: 'varchar' })
  event_type!: string; // e.g., 'payment.captured', 'payment.failed'

  @Column({ type: 'varchar', default: 'pending' })
  status!: WebhookEventStatus;

  @Column({ type: 'jsonb' })
  payload!: any; // Raw webhook payload

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at?: Date;
}
