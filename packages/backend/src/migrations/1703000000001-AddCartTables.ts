import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCartTables1703000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create carts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "status" varchar DEFAULT 'active',
        "converted_to_order_id" uuid,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_carts_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      )
    `);

    // Create cart_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cart_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cart_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price_cents" bigint NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_cart_items_cart" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_cart_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id"),
        UNIQUE("cart_id", "product_id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_carts_customer" ON "carts"("customer_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_carts_status" ON "carts"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cart_items_cart" ON "cart_items"("cart_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cart_items_product" ON "cart_items"("product_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
  }
}
