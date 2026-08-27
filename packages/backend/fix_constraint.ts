import { AppDataSource } from './src/config/database.js';

async function fix() {
  await AppDataSource.initialize();
  
  try {
    // Drop the existing constraint
    console.log('Dropping constraint...');
    await AppDataSource.query(
      `ALTER TABLE "payment_attempts" DROP CONSTRAINT IF EXISTS "uk_payment_attempts_order_attempt"`
    );
    console.log('Dropped.');
    
    // Recreate it
    console.log('Recreating constraint...');
    await AppDataSource.query(
      `ALTER TABLE "payment_attempts" ADD CONSTRAINT "uk_payment_attempts_order_attempt" UNIQUE ("order_id", "attempt_number")`
    );
    console.log('Recreated.');
    
    // Verify it exists
    const constraints = await AppDataSource.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'payment_attempts' AND constraint_type = 'UNIQUE'
    `);
    console.log('Constraints now:', constraints.map((c: any) => c.constraint_name));
    
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  
  await AppDataSource.destroy();
}

fix().catch(console.error);
