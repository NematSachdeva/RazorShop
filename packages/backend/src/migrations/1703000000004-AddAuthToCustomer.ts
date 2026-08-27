import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthToCustomer1703000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add password_hash and role columns to customers
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD COLUMN "password_hash" varchar,
      ADD COLUMN "role" varchar DEFAULT 'customer'
    `);

    // Create index on email for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_role" ON "customers"("role")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_role"`);
    await queryRunner.query(`
      ALTER TABLE "customers" 
      DROP COLUMN "role",
      DROP COLUMN "password_hash"
    `);
  }
}
