import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type TimelineEventType = 'APPLICATION_SUBMITTED' | 'APPROVED' | 'REJECTED';

@Entity('merchant_application_timeline')
export class MerchantApplicationTimeline {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  application_id!: string;

  @Column({ type: 'varchar' })
  event_type!: TimelineEventType;

  @Column({ type: 'varchar', nullable: true })
  actor_id?: string;

  @Column({ type: 'varchar', default: 'system' })
  actor_role!: 'applicant' | 'admin' | 'system';

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  created_at!: Date;
}
