import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1703000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create customers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "phone" varchar,
        "name" varchar,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Create products table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text,
        "price_cents" bigint NOT NULL,
        "category" varchar,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Create inventory table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL UNIQUE,
        "quantity_on_hand" integer DEFAULT 0,
        "reserved" integer DEFAULT 0,
        "last_updated" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_inventory_product" FOREIGN KEY ("product_id") REFERENCES "products"("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_customers_email" ON "customers"("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products"("category")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_inventory_product" ON "inventory"("product_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
