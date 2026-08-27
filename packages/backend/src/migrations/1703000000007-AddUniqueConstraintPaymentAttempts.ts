import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintPaymentAttempts1703000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add UNIQUE constraint on (order_id, attempt_number) to prevent duplicate attempt numbers
    // This ensures that for each order, each attempt_number value is unique
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD CONSTRAINT "uk_payment_attempts_order_attempt" UNIQUE ("order_id", "attempt_number")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the UNIQUE constraint
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP CONSTRAINT "uk_payment_attempts_order_attempt"`
    );
  }
}
