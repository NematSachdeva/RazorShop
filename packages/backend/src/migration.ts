import { AppDataSource } from './config/database.js';

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    console.log('Running migrations...');
    
    const migrations = await AppDataSource.runMigrations();
    console.log(`Ran ${migrations.length} migration(s)`);
    
    await AppDataSource.destroy();
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
