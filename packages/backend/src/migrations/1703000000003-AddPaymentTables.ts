import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentTables1703000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payment_attempts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "razorpay_order_id" varchar,
        "attempt_number" integer DEFAULT 1,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_payment_attempts_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      )
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "razorpay_payment_id" varchar,
        "razorpay_signature" varchar,
        "status" varchar DEFAULT 'initiated',
        "amount_cents" bigint NOT NULL,
        "failure_reason" text,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_payments_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id"),
        CONSTRAINT "uk_payments_order_id" UNIQUE ("order_id")
      )
    `);

    // Create webhook_events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "webhook_id" varchar NOT NULL UNIQUE,
        "event_type" varchar NOT NULL,
        "status" varchar DEFAULT 'pending',
        "payload" jsonb NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        "processed_at" TIMESTAMP
      )
    `);

    // Create indexes for payment_attempts
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payment_attempts_order" ON "payment_attempts"("order_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payment_attempts_razorpay" ON "payment_attempts"("razorpay_order_id")`);

    // Create indexes for payments
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_order" ON "payments"("order_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_razorpay" ON "payments"("razorpay_payment_id")`);

    // Create indexes for webhook_events
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhook_events_webhook_id" ON "webhook_events"("webhook_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhook_events_status" ON "webhook_events"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhook_events_created" ON "webhook_events"("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_attempts"`);
  }
}
