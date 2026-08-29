/**
 * M5/M6 Recovery Management Routes
 * 
 * Handles payment failure recovery (M5), agent decision management (M5),
 * and customer interactions & promise-to-pay workflow (M6).
 */

import { Router, Request, Response } from 'express';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { RecoveryAgentService } from '../services/RecoveryAgentService.js';
import { CustomerRecoveryService } from '../services/CustomerRecoveryService.js';
import { AppDataSource } from '../config/database.js';

const router = Router();

const paymentFailureService = new PaymentFailureService(AppDataSource);
const recoveryAgentService = new RecoveryAgentService(AppDataSource);
const customerRecoveryService = new CustomerRecoveryService(AppDataSource);

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

/**
 * POST /api/recovery/respond
 * M6: Handle customer response to recovery attempt
 * Supports intents: accepted, refused, promised, unclear
 * 
 * Request body:
 * {
 *   recovery_case_id: string (uuid)
 *   customer_id: string (uuid)
 *   intent: 'accepted' | 'refused' | 'promised' | 'unclear'
 *   channel: 'email' | 'in_app' | 'whatsapp' | 'sms'
 *   promised_deadline?: Date (required if intent='promised')
 * }
 */
router.post('/respond', async (req: Request, res: Response) => {
  try {
    const { recovery_case_id, customer_id, intent, channel, promised_deadline } = req.body;

    // Validate required fields
    if (!recovery_case_id || !customer_id || !intent || !channel) {
      return res.status(400).json({
        error: 'Missing required fields: recovery_case_id, customer_id, intent, channel',
      });
    }

    // Validate intent
    const validIntents = ['accepted', 'refused', 'promised', 'unclear'];
    if (!validIntents.includes(intent)) {
      return res.status(400).json({
        error: `Invalid intent. Must be one of: ${validIntents.join(', ')}`,
      });
    }

    // Validate channel
    const validChannels = ['email', 'in_app', 'whatsapp', 'sms'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({
        error: `Invalid channel. Must be one of: ${validChannels.join(', ')}`,
      });
    }

    // If intent is 'promised', require deadline
    if (intent === 'promised') {
      if (!promised_deadline) {
        return res.status(400).json({
          error: 'promised_deadline is required when intent is "promised"',
        });
      }

      // Parse and validate deadline
      const deadline = new Date(promised_deadline);
      if (isNaN(deadline.getTime())) {
        return res.status(400).json({
          error: 'Invalid promised_deadline format. Must be ISO 8601 date string',
        });
      }

      // Create customer interaction (records the response)
      const interaction = await customerRecoveryService.recordCustomerInteraction({
        recovery_case_id,
        customer_id,
        channel,
        intent,
      });

      // Create promise-to-pay
      // Get recovery case to get the order amount
      const recoveryCase = await paymentFailureService.getRecoveryCase(recovery_case_id);
      if (!recoveryCase || !recoveryCase.order) {
        return res.status(404).json({ error: 'Recovery case or order not found' });
      }

      const promise = await customerRecoveryService.createPromiseToPay({
        recovery_case_id,
        customer_id,
        customer_interaction_id: interaction.id,
        promised_amount_cents: recoveryCase.order.total_cents,
        promised_deadline: deadline,
        merchantIdOverride: 'default-merchant',
      });

      return res.status(200).json({
        success: true,
        message: 'Promise-to-pay created successfully',
        intent,
        recovery_case_id,
        promise_id: promise.id,
        promised_deadline: promise.promised_deadline,
      });
    }

    // For other intents (accepted, refused, unclear)
    // Just handle the response and update recovery case status
    await customerRecoveryService.handleCustomerResponse({
      recovery_case_id,
      customer_id,
      intent,
      channel,
      merchantIdOverride: 'default-merchant',
    });

    res.status(200).json({
      success: true,
      message: `Customer response recorded: ${intent}`,
      intent,
      recovery_case_id,
    });
  } catch (err: any) {
    console.error('Error handling customer response:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
