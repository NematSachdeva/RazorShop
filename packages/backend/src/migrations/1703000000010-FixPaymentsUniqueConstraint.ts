import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPaymentsUniqueConstraint1703000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the missing UNIQUE constraint on payments(order_id)
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "uk_payments_order_id" UNIQUE ("order_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the UNIQUE constraint
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "uk_payments_order_id"`
    );
  }
}
