import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantTable1703000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create merchants table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "contact_phone" varchar,
        "status" varchar DEFAULT 'active',
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_merchants_email" ON "merchants"("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_merchants_status" ON "merchants"("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "merchants"`);
  }
}
