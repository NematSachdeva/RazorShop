import { AppDataSource } from './src/config/database.js';

async function check() {
  await AppDataSource.initialize();
  
  const cols = await AppDataSource.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payment_attempts'
    ORDER BY ordinal_position
  `);
  
  console.log('Columns in payment_attempts:');
  cols.forEach((c: any) => {
    console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
  });
  
  await AppDataSource.destroy();
}

check().catch(console.error);
