import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerchantToProduct1703000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add merchant_id column to products (nullable for existing seeded products)
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD COLUMN "merchant_id" uuid REFERENCES "merchants"("id")
    `);

    // Create index for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_products_merchant" ON "products"("merchant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_merchant"`);
    await queryRunner.query(`
      ALTER TABLE "products" 
      DROP COLUMN "merchant_id"
    `);
  }
}
