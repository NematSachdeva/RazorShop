import { env } from './config/env.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { createApp } from './app.js';

async function main() {
  try {
    console.log(`Starting server in ${env.NODE_ENV} mode...`);

    // Initialize database
    await initializeDatabase();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(env.PORT, () => {
      console.log(`✓ Server running on http://localhost:${env.PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
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
