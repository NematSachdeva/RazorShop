import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AuditEventType =
  | 'payment_failure_detected'
  | 'recovery_case_created'
  | 'recovery_action_initiated'
  | 'agent_decision_made'
  | 'guard_rail_triggered'
  | 'customer_opted_out'
  | 'recovery_case_resolved'
  | 'recovery_case_abandoned'
  | 'customer_responded'
  | 'customer_response_processed'
  | 'promise_to_pay_created'
  | 'promise_deadline_missed'
  | 'promise_fulfilled'
  | 'email_sent'
  | 'email_failed'
  | 'email_skipped_opt_out'
  | 'merchant_manual_email_sent'
  | 'merchant_manual_email_failed'
  | 'merchant_manual_email_opt_out'
  | 'payment_confirmation_email_sent'
  | 'payment_confirmation_email_failed'
  | 'insights_generated'
  | 'insights_generation_failed';

@Entity('audit_logs')
@Index(['entity_type', 'entity_id'])
@Index(['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  event_type!: AuditEventType;

  @Column({ type: 'varchar', length: 50 })
  entity_type!: string; // e.g., 'payment_failure', 'recovery_case', 'agent_decision'

  @Column({ type: 'uuid' })
  entity_id!: string;

  @Column({ type: 'uuid', nullable: true })
  actor_id?: string; // User/system that triggered the event

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: {
    previous_state?: Record<string, unknown>;
    new_state?: Record<string, unknown>;
    reason?: string;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip_address?: string;

  @CreateDateColumn()
  created_at!: Date;
}
