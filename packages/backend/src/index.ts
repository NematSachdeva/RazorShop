import { env } from './config/env.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { createApp } from './app.js';
import { schedulerService } from './services/SchedulerService.js';

async function main() {
  try {
    console.log(`Starting server in ${env.NODE_ENV} mode...`);

    // Initialize database
    await initializeDatabase();

    // Auto-seed real catalog products in dev/prod if catalog is low
    if (env.NODE_ENV !== 'test') {
      const { AppDataSource } = await import('./config/database.js');
      const { Product } = await import('./models/Product.js');
      const productRepo = AppDataSource.getRepository(Product);
      const count = await productRepo
        .createQueryBuilder('product')
        .where("product.name NOT ILIKE :testPattern AND (product.category IS NULL OR product.category != 'test')", { testPattern: 'Test Product%' })
        .getCount();

      if (count < 20) {
        console.log('Catalog count low (' + count + '). Auto-seeding catalog products...');
        const { seedDatabase } = await import('./seed.js');
        await seedDatabase(AppDataSource);
      }
    }

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(env.PORT, () => {
      console.log(`✓ Server running on http://localhost:${env.PORT}`);
    });

    // Start scheduler (M6 promise-to-pay workflow)
    if (env.NODE_ENV !== 'test') {
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
