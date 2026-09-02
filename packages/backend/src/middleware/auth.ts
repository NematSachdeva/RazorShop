import { Request, Response, NextFunction } from 'express';
import { AuthService, JWTPayload } from '../services/AuthService.js';
import { MerchantApplication } from '../models/MerchantApplication.js';
import { Merchant } from '../models/Merchant.js';
import { AppDataSource } from '../config/database.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const authService = new AuthService();

/**
 * Middleware to authenticate JWT token from Authorization header
 * Expected format: Authorization: Bearer <token>
 */
export function createAuthenticate(service: AuthService = authService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix
      const decoded = service.verifyToken(token);

      if (!decoded || !decoded.id) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (decoded.role === 'admin') {
        req.user = decoded;
        return next();
      }

      // Verify user exists in database (Customer or Merchant) before proceeding to downstream handlers
      const customer = await service.getCustomerById(decoded.id);
      if (!customer) {
        const ds = (service as any)['dataSource'] || AppDataSource;
        let merchant = null;
        if (ds && ds.isInitialized) {
          const merchantRepo = ds.getRepository(Merchant);
          merchant = await merchantRepo.findOne({ where: { id: decoded.id } });
        }
        if (!merchant) {
          return res.status(401).json({ error: 'User account no longer exists or session is invalid' });
        }
      }

      // Attach user info to request
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}

export const authenticate = createAuthenticate();

/**
 * Middleware to check if user has a specific role
 */
export function requireRole(role: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Middleware to check if user is customer
 */
export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Only customers can perform this action' });
  }

  next();
}

/**
 * Middleware to check if user is merchant
 */
export function requireMerchant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'merchant' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only merchants can perform this action' });
  }

  next();
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }

  next();
}

/**
 * Factory for requireApprovedMerchant middleware with customizable AuthService / DataSource
 */
export function createRequireApprovedMerchant(service: AuthService = authService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'merchant') {
      return res.status(403).json({ error: 'Only merchants can perform this action' });
    }

    try {
      const dataSource = (service as any)['dataSource'];
      if (!dataSource || !dataSource.isInitialized) {
        return next();
      }

      const appRepo = dataSource.getRepository(MerchantApplication);
      const app = await appRepo.findOne({
        where: [{ customer_id: req.user.id }, { email: req.user.email }],
        order: { created_at: 'DESC' },
      });

      if (app) {
        if (app.status === 'pending') {
          return res.status(403).json({
            error: 'Merchant application is pending administrator approval',
            application_id: app.id,
            status: 'pending',
          });
        }
        if (app.status === 'rejected') {
          return res.status(403).json({
            error: 'Merchant application has been rejected',
            application_id: app.id,
            status: 'rejected',
            rejection_reason: app.rejection_reason || 'Application did not meet criteria',
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireApprovedMerchant = createRequireApprovedMerchant();
