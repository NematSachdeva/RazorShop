import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderTables1703000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create orders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "order_number" varchar UNIQUE NOT NULL,
        "status" varchar DEFAULT 'pending',
        "subtotal_cents" bigint NOT NULL,
        "tax_cents" bigint DEFAULT 0,
        "total_cents" bigint NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_orders_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      )
    `);

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price_cents" bigint NOT NULL,
        "line_total_cents" bigint NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_order_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id"),
        UNIQUE("order_id", "product_id")
      )
    `);

    // Create indexes for orders
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_customer" ON "orders"("customer_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_number" ON "orders"("order_number")`);

    // Create indexes for order_items
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items"("order_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_order_items_product" ON "order_items"("product_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
  }
}
