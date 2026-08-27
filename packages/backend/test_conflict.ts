import { AppDataSource } from './src/config/database.js';

async function test() {
  await AppDataSource.initialize();
  
  try {
    // Test 1: Try ON CONFLICT with constraint name
    console.log('Test 1: ON CONFLICT ON CONSTRAINT...');
    const result1 = await AppDataSource.query(`
      INSERT INTO "payment_attempts"
        ("id", "order_id", "razorpay_order_id", "attempt_number", "created_at", "updated_at")
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', NULL, 999, now(), now())
      ON CONFLICT ON CONSTRAINT "uk_payment_attempts_order_attempt" DO NOTHING
      RETURNING "id"
    `);
    console.log('Success:', result1);
  } catch (e: any) {
    console.log('Failed:', e.message);
  }
  
  try {
    // Test 2: Try ON CONFLICT with column list
    console.log('\nTest 2: ON CONFLICT (column list)...');
    const result2 = await AppDataSource.query(`
      INSERT INTO "payment_attempts"
        ("id", "order_id", "razorpay_order_id", "attempt_number", "created_at", "updated_at")
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', NULL, 999, now(), now())
      ON CONFLICT ("order_id", "attempt_number") DO NOTHING
      RETURNING "id"
    `);
    console.log('Success:', result2);
  } catch (e: any) {
    console.log('Failed:', e.message);
  }
  
  await AppDataSource.destroy();
}

test().catch(console.error);
