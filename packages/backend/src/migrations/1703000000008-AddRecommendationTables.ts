import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationTables1703000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create recommendations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recommendations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id" uuid,
        "cart_id" uuid,
        "recommendation_type" varchar(50) NOT NULL,
        "reason" varchar(50) NOT NULL,
        "recommended_products" jsonb NOT NULL,
        "reasoning" jsonb,
        "metadata" jsonb,
        "shown_count" integer DEFAULT 0,
        "clicked_count" integer DEFAULT 0,
        "added_to_cart_count" integer DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_recommendations_product" FOREIGN KEY ("product_id") REFERENCES "products"("id"),
        CONSTRAINT "fk_recommendations_cart" FOREIGN KEY ("cart_id") REFERENCES "carts"("id")
      )
    `);

    // Create recommendation_events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recommendation_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "recommendation_id" uuid NOT NULL,
        "product_id" uuid,
        "event_type" varchar(50) NOT NULL,
        "customer_id" uuid,
        "order_id" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "fk_recommendation_events_recommendation" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_recommendation_events_product" FOREIGN KEY ("product_id") REFERENCES "products"("id"),
        CONSTRAINT "fk_recommendation_events_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id"),
        CONSTRAINT "fk_recommendation_events_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      )
    `);

    // Create indexes for recommendations
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendations_product" ON "recommendations"("product_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendations_cart" ON "recommendations"("cart_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendations_type" ON "recommendations"("recommendation_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendations_reason" ON "recommendations"("reason")`);

    // Create indexes for recommendation_events
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendation_events_recommendation" ON "recommendation_events"("recommendation_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendation_events_product" ON "recommendation_events"("product_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendation_events_event_type" ON "recommendation_events"("event_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendation_events_customer" ON "recommendation_events"("customer_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recommendation_events_order" ON "recommendation_events"("order_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendation_events_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendation_events_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendation_events_event_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendation_events_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendation_events_recommendation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendations_reason"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendations_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendations_cart"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recommendations_product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recommendation_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recommendations"`);
  }
}
