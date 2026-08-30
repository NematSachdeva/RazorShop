import { env } from './config/env.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { createApp } from './app.js';
import { schedulerService } from './services/SchedulerService.js';

async function main() {
  try {
    console.log(`Starting server in ${env.NODE_ENV} mode...`);

    // Initialize database
    await initializeDatabase();

    // Auto-seed real catalog products and demo accounts
    const { AppDataSource } = await import('./config/database.js');
    const { seedDatabase } = await import('./seed.js');
    await seedDatabase(AppDataSource);

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(env.PORT, () => {
      console.log(`✓ Server running on http://localhost:${env.PORT}`);
    });

    // Start scheduler (M6 promise-to-pay workflow) - ONLY when SCHEDULER_ENABLED=true
    if (env.SCHEDULER_ENABLED && env.NODE_ENV !== 'test') {
      await schedulerService.start();
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      
      // Stop scheduler
      await schedulerService.stop();
      
      server.close(() => {
        console.log('HTTP server closed');
      });
      await closeDatabase();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
