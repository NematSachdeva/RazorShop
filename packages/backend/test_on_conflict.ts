import { AppDataSource } from './src/config/database.js';

async function test() {
  await AppDataSource.initialize();
  
  // First verify the constraint exists
  const constraints = await AppDataSource.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'payment_attempts' AND constraint_type = 'UNIQUE'
  `);
  console.log('UNIQUE constraints on payment_attempts:');
  constraints.forEach((c: any) => console.log(`  - ${c.constraint_name}`));
  
  // Now try the ON CONFLICT with column list
  try {
    const result = await AppDataSource.query(
      `INSERT INTO "payment_attempts"
        ("id", "order_id", "razorpay_order_id", "attempt_number", "created_at", "updated_at")
       VALUES (gen_random_uuid(), $1, NULL, $2, now(), now())
       ON CONFLICT ("order_id", "attempt_number") DO NOTHING
       RETURNING "id"`,
      ['00000000-0000-0000-0000-000000000001', 999]
    );
    console.log('\nON CONFLICT with column list: SUCCESS');
    console.log('Result:', result);
  } catch (e: any) {
    console.log('\nON CONFLICT with column list: FAILED');
    console.log('Error:', e.message);
  }
  
  await AppDataSource.destroy();
}

test().catch(console.error);
