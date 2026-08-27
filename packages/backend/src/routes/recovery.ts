/**
 * M5 Recovery Management Routes
 * 
 * Handles payment failure recovery and agent decision management.
 */

import { Router, Request, Response } from 'express';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { RecoveryAgentService } from '../services/RecoveryAgentService.js';
import { AppDataSource } from '../config/database.js';

const router = Router();

const paymentFailureService = new PaymentFailureService(AppDataSource);
const recoveryAgentService = new RecoveryAgentService(AppDataSource);

/**
 * GET /api/recovery/cases/:id
 * Retrieve a recovery case by ID
 */
router.get('/cases/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recoveryCase = await paymentFailureService.getRecoveryCase(id);
    
    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }
    
    res.json(recoveryCase);
  } catch (err) {
    console.error('Error retrieving recovery case:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/recovery/cases/:id/decisions
 * Retrieve all agent decisions for a recovery case
 */
router.get('/cases/:id/decisions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recoveryCase = await paymentFailureService.getRecoveryCase(id);
    
    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }
    
    res.json({
      recovery_case_id: id,
      decisions: recoveryCase.agent_decisions || [],
    });
  } catch (err) {
    console.error('Error retrieving agent decisions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/recovery/cases/:id/analyze
 * Trigger RecoveryAgent to analyze failure and make a decision
 */
router.post('/cases/:id/analyze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify recovery case exists
    const recoveryCase = await paymentFailureService.getRecoveryCase(id);
    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }
    
    // Trigger AI analysis and decision
    const decision = await recoveryAgentService.analyzeFailureAndDecide(id);
    
    res.json({
      success: true,
      decision,
      recovery_case_id: id,
    });
  } catch (err: any) {
    console.error('Error analyzing recovery case:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/recovery/cases/:id/opt-out
 * Customer opts out of recovery attempts
 */
router.post('/cases/:id/opt-out', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify recovery case exists
    const recoveryCase = await paymentFailureService.getRecoveryCase(id);
    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }
    
    // Get merchant ID from order's customer (hardcoded to 'default-merchant' for now)
    const merchantId = 'default-merchant';
    
    // Add customer to opt-out list
    const config = await paymentFailureService.optOutCustomer(merchantId, recoveryCase.customer_id);
    
    // Update recovery case status to customer_declined
    const RecoveryCase = AppDataSource.getRepository('RecoveryCase');
    recoveryCase.status = 'customer_declined';
    await RecoveryCase.save(recoveryCase);
    
    res.json({
      success: true,
      message: 'Customer opted out of recovery attempts',
      recovery_case_id: id,
      customer_id: recoveryCase.customer_id,
    });
  } catch (err: any) {
    console.error('Error opting out customer:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/recovery/config/:merchantId
 * Retrieve merchant recovery configuration
 */
router.get('/config/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const config = await paymentFailureService.getMerchantConfig(merchantId);
    res.json(config);
  } catch (err: any) {
    console.error('Error retrieving merchant config:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * PUT /api/recovery/config/:merchantId
 * Update merchant recovery configuration (guard rails)
 */
router.put('/config/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const updates = req.body;
    
    // Validate updates (optional - guard against invalid configs)
    if (updates.max_recovery_attempts && updates.max_recovery_attempts < 1) {
      return res.status(400).json({ error: 'max_recovery_attempts must be at least 1' });
    }
    if (updates.max_discount_percent && (updates.max_discount_percent < 0 || updates.max_discount_percent > 100)) {
      return res.status(400).json({ error: 'max_discount_percent must be between 0 and 100' });
    }
    
    const config = await paymentFailureService.updateMerchantConfig(merchantId, updates);
    res.json(config);
  } catch (err: any) {
    console.error('Error updating merchant config:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
