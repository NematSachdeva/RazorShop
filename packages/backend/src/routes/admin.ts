import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AdminService } from '../services/AdminService.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { createAuthenticate, requireAdmin } from '../middleware/auth.js';
import { AppDataSource } from '../config/database.js';
import { ApplicationStatus } from '../models/MerchantApplication.js';

export function createAdminRouter(
  dataSource: DataSource = AppDataSource,
  authService: AuthService = defaultAuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const adminService = new AdminService(dataSource);

  /**
   * GET /api/admin/summary
   * Summary metrics for applications
   */
  router.get('/summary', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const summary = await adminService.getSummaryMetrics();
      res.json(summary);
    } catch (err: any) {
      console.error('Error fetching admin summary:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/admin/applications
   * List merchant applications
   */
  router.get('/applications', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as ApplicationStatus | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;

      const validStatuses: ApplicationStatus[] = ['pending', 'approved', 'rejected'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}` });
      }

      const result = await adminService.getApplications(status, limit, offset);
      res.json(result);
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * GET /api/admin/applications/:id
   * Get application details and timeline
   */
  router.get('/applications/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const application = await adminService.getApplicationById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      res.json(application);
    } catch (err: any) {
      console.error('Error fetching application details:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/applications/:id/approve
   * Approve a merchant application
   */
  router.post('/applications/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reviewerId = req.user?.id || 'admin';
      const updated = await adminService.approveApplication(id, reviewerId);
      res.json(updated);
    } catch (err: any) {
      console.error('Error approving application:', err);
      res.status(400).json({ error: err.message || 'Failed to approve application' });
    }
  });

  /**
   * POST /api/admin/applications/:id/reject
   * Reject a merchant application
   */
  router.post('/applications/:id/reject', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;
      const reviewerId = req.user?.id || 'admin';

      if (!rejection_reason || typeof rejection_reason !== 'string' || rejection_reason.trim() === '') {
        return res.status(400).json({ error: 'A meaningful rejection_reason is required to reject an application' });
      }

      const updated = await adminService.rejectApplication(id, reviewerId, rejection_reason);
      res.json(updated);
    } catch (err: any) {
      console.error('Error rejecting application:', err);
      res.status(400).json({ error: err.message || 'Failed to reject application' });
    }
  });

  return router;
}

export default createAdminRouter();
