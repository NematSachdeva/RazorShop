import { AppDataSource } from './src/config/database.js';

async function list() {
  await AppDataSource.initialize();
  
  const migrations = await AppDataSource.query(`
    SELECT timestamp, name FROM migrations ORDER BY timestamp
  `);
  
  console.log('Applied migrations:');
  migrations.forEach((m: any) => {
    console.log(`  - [${m.timestamp}] ${m.name}`);
  });
  
  await AppDataSource.destroy();
}

list().catch(console.error);
