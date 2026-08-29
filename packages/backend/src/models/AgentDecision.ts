import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export type DecisionType =
  | 'retry_payment'
  | 'offer_discount'
  | 'escalate'
  | 'abandon'
  | 'contact_customer';

@Entity('agent_decisions')
export class AgentDecision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recovery_case_id!: string;

  @ManyToOne('RecoveryCase', 'agent_decisions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recovery_case_id' })
  recovery_case!: any;

  @Column({ type: 'varchar', length: 50 })
  decision!: DecisionType;

  @Column({ type: 'text' })
  explanation!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence_score?: number; // 0-100

  @Column({ type: 'jsonb', nullable: true })
  context?: {
    failure_reason?: string;
    customer_history?: Record<string, unknown>;
    order_details?: Record<string, unknown>;
    ai_analysis?: string;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: {
    discount_percent?: number;
    retry_count?: number;
    [key: string]: unknown;
  } | null;

  @Column({ type: 'boolean', default: false })
  guard_rails_enforced!: boolean;

  @Column({ type: 'text', nullable: true })
  guard_rail_violations?: string; // If any rules were violated

  @CreateDateColumn()
  made_at!: Date;
}
