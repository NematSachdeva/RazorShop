import { Request, Response, NextFunction } from 'express';
import { AuthService, JWTPayload } from '../services/AuthService.js';

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

      // Verify customer exists in database before proceeding to downstream handlers
      const customer = await service.getCustomerById(decoded.id);
      if (!customer) {
        return res.status(401).json({ error: 'User account no longer exists or session is invalid' });
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

  if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: 'Only merchants can perform this action' });
  }

  next();
}
