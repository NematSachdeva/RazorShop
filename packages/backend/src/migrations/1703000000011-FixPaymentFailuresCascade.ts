import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPaymentFailuresCascade1703000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old FK constraint with RESTRICT
    await queryRunner.query(
      `ALTER TABLE "payment_failures" DROP CONSTRAINT "fk_payment_failures_payment"`
    );

    // Add new FK constraint with CASCADE
    await queryRunner.query(
      `ALTER TABLE "payment_failures" 
       ADD CONSTRAINT "fk_payment_failures_payment" 
       FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to RESTRICT
    await queryRunner.query(
      `ALTER TABLE "payment_failures" DROP CONSTRAINT "fk_payment_failures_payment"`
    );

    await queryRunner.query(
      `ALTER TABLE "payment_failures" 
       ADD CONSTRAINT "fk_payment_failures_payment" 
       FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT`
    );
  }
}
