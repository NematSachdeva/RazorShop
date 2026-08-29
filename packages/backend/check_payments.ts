import { AppDataSource } from './src/config/database.js';

async function check() {
  await AppDataSource.initialize();
  
  // Check constraints on payments table
  const constraints = await AppDataSource.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'payments'
  `);
  
  console.log('Constraints on payments:');
  constraints.forEach((c: any) => {
    console.log(`  - ${c.constraint_name} (${c.constraint_type})`);
  });
  
  await AppDataSource.destroy();
}

check().catch(console.error);
