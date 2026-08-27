import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const isConnected = AppDataSource.isInitialized;

    res.status(isConnected ? 200 : 503).json({
      status: isConnected ? 'ok' : 'error',
      database: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
