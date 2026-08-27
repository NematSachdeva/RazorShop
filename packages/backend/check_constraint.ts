import { AppDataSource } from './src/config/database.js';

async function check() {
  await AppDataSource.initialize();
  
  // Check the columns in the unique constraint
  const result = await AppDataSource.query(`
    SELECT a.attname
    FROM pg_attribute a
    JOIN pg_class t ON a.attrelid = t.oid
    JOIN pg_namespace s ON t.relnamespace = s.oid
    JOIN pg_constraint c ON c.conrelid = t.oid
    WHERE s.nspname = 'public'
      AND t.relname = 'payment_attempts'
      AND c.conname = 'uk_payment_attempts_order_attempt'
      AND a.attnum = ANY(c.conkey)
    ORDER BY a.attnum
  `);
  
  console.log('Columns in uk_payment_attempts_order_attempt constraint:');
  result.forEach((r: any) => {
    console.log(`  - ${r.attname}`);
  });
  
  await AppDataSource.destroy();
}

check().catch(console.error);
