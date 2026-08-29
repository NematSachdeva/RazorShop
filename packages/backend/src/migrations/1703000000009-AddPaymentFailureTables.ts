import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentFailureTables1703000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payment_failures table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_failures" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "reason" varchar(50) NOT NULL,
        "error_message" text,
        "error_context" jsonb,
        "failure_count" integer DEFAULT 1,
        "last_failure_at" TIMESTAMP,
        "detected_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_payment_failures_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE,
        CONSTRAINT "uk_payment_failures_payment" UNIQUE ("payment_id")
      )
    `);

    // Create recovery_cases table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recovery_cases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_failure_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "status" varchar(50) NOT NULL,
        "recovery_attempts" integer DEFAULT 0,
        "max_recovery_attempts" integer DEFAULT 0,
        "recovery_notes" text,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        "resolved_at" TIMESTAMP,
        CONSTRAINT "fk_recovery_cases_payment_failure" FOREIGN KEY ("payment_failure_id") REFERENCES "payment_failures"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_recovery_cases_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_recovery_cases_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);

    // Create recovery_actions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recovery_actions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "recovery_case_id" uuid NOT NULL,
        "action_type" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL,
        "action_details" jsonb,
        "result" text,
        "success" boolean DEFAULT false,
        "created_at" TIMESTAMP DEFAULT now(),
        "executed_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        CONSTRAINT "fk_recovery_actions_recovery_case" FOREIGN KEY ("recovery_case_id") REFERENCES "recovery_cases"("id") ON DELETE CASCADE
      )
    `);

    // Create agent_decisions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_decisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "recovery_case_id" uuid NOT NULL,
        "decision" varchar(50) NOT NULL,
        "explanation" text NOT NULL,
        "confidence_score" numeric(5, 2),
        "context" jsonb,
        "parameters" jsonb,
        "guard_rails_enforced" boolean DEFAULT false,
        "guard_rail_violations" text,
        "made_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_agent_decisions_recovery_case" FOREIGN KEY ("recovery_case_id") REFERENCES "recovery_cases"("id") ON DELETE CASCADE
      )
    `);

    // Create merchant_configs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchant_configs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchant_id" uuid NOT NULL,
        "max_recovery_attempts" integer DEFAULT 3,
        "max_discount_percent" integer DEFAULT 30,
        "allowed_channels" jsonb DEFAULT '["email", "sms"]',
        "allow_partial_refund" boolean DEFAULT false,
        "max_refund_percent" integer DEFAULT 50,
        "customer_opt_outs" jsonb DEFAULT '[]',
        "auto_retry_enabled" boolean DEFAULT true,
        "retry_delay_hours" integer DEFAULT 24,
        "ai_diagnosis_enabled" boolean DEFAULT true,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_merchant_configs_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "uk_merchant_configs_merchant" UNIQUE ("merchant_id")
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_type" varchar(50) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "actor_id" uuid,
        "description" text,
        "details" jsonb,
        "ip_address" varchar(100),
        "created_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(`CREATE INDEX "idx_payment_failures_payment_id" ON "payment_failures"("payment_id")`);
    await queryRunner.query(`CREATE INDEX "idx_recovery_cases_payment_failure" ON "recovery_cases"("payment_failure_id")`);
    await queryRunner.query(`CREATE INDEX "idx_recovery_cases_order" ON "recovery_cases"("order_id")`);
    await queryRunner.query(`CREATE INDEX "idx_recovery_cases_customer" ON "recovery_cases"("customer_id")`);
    await queryRunner.query(`CREATE INDEX "idx_recovery_cases_status" ON "recovery_cases"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_recovery_actions_recovery_case" ON "recovery_actions"("recovery_case_id")`);
    await queryRunner.query(`CREATE INDEX "idx_recovery_actions_status" ON "recovery_actions"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_agent_decisions_recovery_case" ON "agent_decisions"("recovery_case_id")`);
    await queryRunner.query(`CREATE INDEX "idx_merchant_configs_merchant" ON "merchant_configs"("merchant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_created" ON "audit_logs"("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_merchant_configs_merchant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agent_decisions_recovery_case"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_actions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_actions_recovery_case"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_cases_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_cases_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_cases_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recovery_cases_payment_failure"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_failures_payment_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_decisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recovery_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recovery_cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_failures"`);
  }
}
