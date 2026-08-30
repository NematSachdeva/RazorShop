import { Router, Request, Response } from 'express';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuthenticate } from '../middleware/auth.js';

export function createAuthRouter(service: AuthService = defaultAuthService): Router {
  const router = Router();
  const authMiddleware = createAuthenticate(service);

  /**
   * POST /api/auth/register
   * Register a new customer or merchant
   */
  router.post(
    '/register',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password, name, role, business_name, phone, reason } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (role === 'admin') {
        return res.status(403).json({ error: 'Public administrator registration is prohibited' });
      }

      try {
        const result = await service.register({
          email,
          password,
          name,
          role: role || 'customer',
          business_name,
          phone,
          reason,
        });

        res.status(201).json(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already registered')) {
            return res.status(409).json({ error: error.message });
          }
          if (error.message.includes('at least 6 characters')) {
            return res.status(400).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  /**
   * POST /api/auth/login
   * Login with email and password
   * Returns JWT token
   */
  router.post(
    '/login',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      try {
        const result = await service.login({ email, password });
        res.status(200).json(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Invalid')) {
            return res.status(401).json({ error: 'Invalid email or password' });
          }
        }
        throw error;
      }
    })
  );

  /**
   * GET /api/auth/me
   * Get current authenticated user info
   * Requires JWT token in Authorization header
   */
  router.get(
    '/me',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (req.user.role === 'admin') {
        return res.json({
          id: req.user.id,
          email: req.user.email,
          name: 'System Administrator',
          role: 'admin',
        });
      }

      const customer = await service.getCustomerById(req.user.id);
      if (!customer) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: customer.id,
        email: customer.email,
        name: customer.name,
        role: customer.role,
      });
    })
  );

  return router;
}

export default createAuthRouter();
