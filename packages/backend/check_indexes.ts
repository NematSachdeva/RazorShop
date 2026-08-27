import { AppDataSource } from './src/config/database.js';

async function check() {
  await AppDataSource.initialize();
  
  const indexes = await AppDataSource.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'payment_attempts'
  `);
  
  console.log('Indexes on payment_attempts:');
  indexes.forEach((idx: any) => {
    console.log(`  - ${idx.indexname}`);
    console.log(`    Definition: ${idx.indexdef}`);
  });
  
  await AppDataSource.destroy();
}

check().catch(console.error);
