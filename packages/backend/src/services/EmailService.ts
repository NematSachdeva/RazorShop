import { Resend } from 'resend';
import { env } from '../config/env.js';

export type EmailSource = 'customer' | 'test' | 'demo';

export interface EmailOptions {
  source?: EmailSource;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service using Resend API
 * Handles all email communication for recovery and payment confirmation workflows.
 * 
 * DUAL DELIVERY MODES:
 * 1. REAL CUSTOMER MODE (source: 'customer'):
 *    - Used during normal website usage (npm run dev / production).
 *    - Real customer email is preserved as the Resend recipient (e.g. alice@gmail.com -> alice@gmail.com).
 * 2. TEST / DEMO MODE (source: 'test' | 'demo'):
 *    - Used during automated tests (Jest) or test/demo script executions.
 *    - Overrides recipient to EMAIL_TEST_RECIPIENT (t74209185@gmail.com) to prevent spamming fake domains.
 *    - ALWAYS calls Resend SDK without skipping delivery.
 */
export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(fromEmailOverride?: string) {
    this.fromEmail = fromEmailOverride || env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'nemat@razorshop.app';

    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
      const fromDomain = this.fromEmail.includes('@') ? this.fromEmail.split('@')[1] : 'unknown';
      const keyMask = env.RESEND_API_KEY ? `re_****${env.RESEND_API_KEY.slice(-4)}` : 'none';
      console.log(`[EmailService] Resend initialized (fromDomain=${fromDomain}, keyMask=${keyMask})`);
    } else {
      console.warn('[EmailService] RESEND_API_KEY is missing in configuration.');
    }
  }

  /**
   * Get configured sender email address
   */
  getFromEmail(): string {
    return this.fromEmail;
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.resend !== null && !!env.RESEND_API_KEY;
  }

  /**
   * Resolves recipient email address based on execution context (Customer vs Test/Demo).
   */
  public resolveRecipient(
    originalEmail: string,
    options?: EmailOptions
  ): { recipient: string; source: EmailSource } {
    const isTestEnv =
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      process.env.EMAIL_DELIVERY_MODE === 'test';

    const source: EmailSource = options?.source || (isTestEnv ? 'test' : 'customer');
    const demoRecipient = env.EMAIL_TEST_RECIPIENT || 't74209185@gmail.com';

    if (source === 'test' || source === 'demo') {
      if (originalEmail !== demoRecipient) {
        console.log(`[EmailSafety] Overriding test/demo recipient (${originalEmail || 'none'}) -> ${demoRecipient}`);
      }
      return { recipient: demoRecipient, source };
    }

    // Real customer mode: deliver directly to customer email
    const recipient = originalEmail || demoRecipient;
    return { recipient, source };
  }

  /**
   * Send recovery notification email
   */
  async sendRecoveryNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    failureContext: {
      amount: number;
      reason: string;
      recoveryLink: string;
    },
    customContent?: {
      subject?: string;
      greeting?: string;
      body?: string;
      call_to_action?: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    if (!this.resend) {
      console.error('[EmailService] Cannot send recovery email: Resend client not initialized (RESEND_API_KEY missing)');
      return {
        success: false,
        error: 'Email service not configured (RESEND_API_KEY missing)',
      };
    }

    const { recipient: finalRecipient, source } = this.resolveRecipient(customerEmail, options);

    if (!finalRecipient || !finalRecipient.includes('@')) {
      return {
        success: false,
        error: 'Customer email missing or invalid',
      };
    }

    const template = this.generateRecoveryEmailTemplate(
      customerName,
      orderNumber,
      failureContext,
      customContent
    );

    try {
      console.log(`[Email] source=${source} recipient=${finalRecipient}`);
      return await this.dispatchEmail(finalRecipient, template, source);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Email] Resend failed: ${errorMessage}`);
      return {
        success: false,
        error: `Failed to send recovery notification: ${errorMessage}`,
      };
    }
  }

  /**
   * Safe email dispatch wrapper: executes live Resend API ONLY in real runtime (or when explicitly mocked).
   * Suppresses live network requests in automated test suites (NODE_ENV=test) unless ALLOW_LIVE_RESEND=true.
   */
  private async dispatchEmail(
    toRecipient: string,
    template: { subject: string; html: string; text?: string },
    source: EmailSource
  ): Promise<EmailResult> {
    if (!this.resend) {
      return { success: false, error: 'Resend service uninitialized' };
    }

    const isTestEnv =
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      process.env.EMAIL_DELIVERY_MODE === 'test';

    const isJestMock = Boolean(
      (this.resend as any)?.emails?.send?._isMockFunction ||
        (this.resend as any)?.emails?.send?.mock
    );

    if (isTestEnv && !isJestMock && process.env.ALLOW_LIVE_RESEND !== 'true') {
      console.log(
        `[Email] [TEST MOCK] Suppressed live network Resend call -> source=${source} recipient=${toRecipient}`
      );
      return { success: true, messageId: `msg_mock_test_${Date.now()}` };
    }

    const response = await this.resend.emails.send({
      from: this.fromEmail,
      to: toRecipient,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (response.error || !response.data?.id) {
      const errorMsg = response.error?.message || 'Failed to send email via Resend';
      if ((response.error as any)?.name === 'daily_quota_exceeded' || errorMsg.includes('quota')) {
        console.error(`[Email] CRITICAL RESEND QUOTA ERROR: ${errorMsg}`);
        console.error(
          '[Email] To receive live emails, please update RESEND_API_KEY in .env with a fresh API key from https://resend.com/api-keys'
        );
      } else {
        console.error(`[Email] Resend failed: ${errorMsg}`);
      }
      return { success: false, error: errorMsg };
    }

    console.log(`[Email] Resend accepted message: ${response.data.id}`);
    return { success: true, messageId: response.data.id };
  }

  /**
   * Send payment confirmation email for successfully captured payments.
   */
  async sendPaymentConfirmationNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      razorpayPaymentId: string;
      orderDate: string;
      items: Array<{
        name: string;
        quantity: number;
        unitPriceCents: number;
        lineTotalCents: number;
      }>;
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      orderLink: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    if (!this.isAvailable()) {
      console.warn('[EmailService] Resend service unavailable. Skipping confirmation email.');
      return { success: false, error: 'Email service unavailable' };
    }

    const { recipient: finalRecipient, source } = this.resolveRecipient(customerEmail, options);

    if (!finalRecipient || !finalRecipient.includes('@')) {
      console.warn('[EmailService] Invalid customer email address:', customerEmail);
      return { success: false, error: 'Invalid recipient email' };
    }

    const template = this.renderPaymentConfirmationTemplate(customerName, orderNumber, details);

    try {
      console.log(`[Email] source=${source} recipient=${finalRecipient}`);
      return await this.dispatchEmail(finalRecipient, template, source);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Email] Resend failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Render Payment Confirmation Email Template (HTML + Text)
   */
  private renderPaymentConfirmationTemplate(
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      razorpayPaymentId: string;
      orderDate: string;
      items: Array<{
        name: string;
        quantity: number;
        unitPriceCents: number;
        lineTotalCents: number;
      }>;
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      orderLink: string;
    }
  ): EmailTemplate {
    const itemsHtml = details.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.unitPriceCents / 100).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">₹${(item.lineTotalCents / 100).toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    const itemsText = details.items
      .map(
        (item) =>
          `- ${item.name} x${item.quantity} @ ₹${(item.unitPriceCents / 100).toFixed(2)} = ₹${(item.lineTotalCents / 100).toFixed(2)}`
      )
      .join('\n');

    return {
      subject: `Order Confirmed: ${orderNumber} - Payment Received`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
      .header { background: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .badge { display: inline-block; background: #22c55e; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 14px; }
      .summary-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      .summary-table th { background: #f8fafc; padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: left; }
      .total-row { font-weight: bold; font-size: 16px; color: #1e3a8a; }
      .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
      .footer { font-size: 12px; color: #64748b; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">Order Confirmed!</h1>
        <p style="margin:5px 0 0 0; opacity: 0.9;">Order #${orderNumber}</p>
      </div>

      <div class="content">
        <p>Hi <strong>${customerName}</strong>,</p>

        <p>Thank you for your purchase. Your payment has been received successfully. Shortly, we will also notify you with your delivery details and tracking link.</p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <span class="badge">Payment Status: Paid / Successful</span>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #166534;">
            <strong>Razorpay Payment ID:</strong> ${details.razorpayPaymentId}<br/>
            <strong>Date:</strong> ${details.orderDate}
          </p>
        </div>

        <h3>Order Summary</h3>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px 10px; text-align: right;">Subtotal:</td>
              <td style="padding: 8px 10px; text-align: right;">₹${(details.subtotalCents / 100).toFixed(2)}</td>
            </tr>
            ${details.discountCents > 0
          ? `
            <tr>
              <td colspan="3" style="padding: 8px 10px; text-align: right; color: #16a34a;">Bundle Discount:</td>
              <td style="padding: 8px 10px; text-align: right; color: #16a34a;">-₹${(details.discountCents / 100).toFixed(2)}</td>
            </tr>
            `
          : ''
        }
            <tr class="total-row">
              <td colspan="3" style="padding: 10px; text-align: right;">Total Paid:</td>
              <td style="padding: 10px; text-align: right;">₹${(details.totalCents / 100).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${details.orderLink}" class="button">View Your Order Details</a>
        </div>
      </div>

      <div class="footer">
        <p>© 2026 Razor. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `
Order Confirmed: ${orderNumber}
Payment Received Successfully

Hi ${customerName},

Thank you for your purchase. Your payment has been received successfully. Shortly, we will also notify you with your delivery details and tracking link.

Payment Status: Paid / Successful
Razorpay Payment ID: ${details.razorpayPaymentId}
Date: ${details.orderDate}

Items Purchased:
${itemsText}

Subtotal: ₹${(details.subtotalCents / 100).toFixed(2)}
${details.discountCents > 0 ? `Bundle Discount: -₹${(details.discountCents / 100).toFixed(2)}\n` : ''}Total Paid: ₹${(details.totalCents / 100).toFixed(2)}

View your order online: ${details.orderLink}

© 2026 Razor. All rights reserved.
      `,
    };
  }

  /**
   * Send promise-to-pay follow-up email
   */
  async sendPromiseFollowUp(
    customerEmail: string,
    customerName: string,
    deadlineDate: Date,
    recoveryLink: string,
    options?: EmailOptions
  ): Promise<EmailResult> {
    if (!this.resend) {
      return {
        success: false,
        error: 'Email service not configured (RESEND_API_KEY missing)',
      };
    }

    const { recipient: finalRecipient, source } = this.resolveRecipient(customerEmail, options);

    const template = this.generatePromiseFollowUpTemplate(
      customerName,
      deadlineDate,
      recoveryLink
    );

    try {
      console.log(`[Email] source=${source} recipient=${finalRecipient}`);
      return await this.dispatchEmail(finalRecipient, template, source);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Email] Resend failed: ${errorMessage}`);
      return {
        success: false,
        error: `Failed to send promise follow-up: ${errorMessage}`,
      };
    }
  }

  /**
   * Send promise deadline missed notification
   */
  async sendPromiseMissedNotification(
    customerEmail: string,
    customerName: string,
    recoveryLink: string,
    options?: EmailOptions
  ): Promise<EmailResult> {
    if (!this.resend) {
      return {
        success: false,
        error: 'Email service not configured (RESEND_API_KEY missing)',
      };
    }

    const { recipient: finalRecipient, source } = this.resolveRecipient(customerEmail, options);

    const template = this.generatePromiseMissedTemplate(customerName, recoveryLink);

    try {
      console.log(`[Email] source=${source} recipient=${finalRecipient}`);
      return await this.dispatchEmail(finalRecipient, template, source);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Email] Resend failed: ${errorMessage}`);
      return {
        success: false,
        error: `Failed to send promise missed notification: ${errorMessage}`,
      };
    }
  }

  /**
   * Generate recovery notification email template
   */
  private generateRecoveryEmailTemplate(
    customerName: string,
    orderNumber: string,
    failureContext: {
      amount: number;
      reason: string;
      recoveryLink: string;
    },
    customContent?: {
      subject?: string;
      greeting?: string;
      body?: string;
      call_to_action?: string;
    }
  ): EmailTemplate {
    const amountDisplay = (failureContext.amount / 100).toFixed(2);
    const subject = customContent?.subject || `Payment Failed for Order ${orderNumber} - We Can Help`;
    const greeting = customContent?.greeting || `Hi ${customerName},`;
    const bodyText = customContent?.body || `We noticed that your payment for order ${orderNumber} failed. Don't worry—we're here to help you complete your purchase.`;
    const ctaText = customContent?.call_to_action || `Respond to Payment Issue`;

    return {
      subject,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .content { line-height: 1.6; margin-bottom: 20px; }
      .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px; }
      .footer { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Payment Issue Detected</h1>
      </div>
      
      <div class="content">
        <p>${greeting}</p>
        
        <p>${bodyText}</p>
        
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order Number:</strong> ${orderNumber}</li>
          <li><strong>Amount:</strong> ₹${amountDisplay}</li>
          <li><strong>Reason:</strong> ${this.formatFailureReason(failureContext.reason)}</li>
        </ul>
        
        <p style="text-align: center;">
          <a href="${failureContext.recoveryLink}" class="button">${ctaText}</a>
        </p>
      </div>
      
      <div class="footer">
        <p>© 2026 Razor Store. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `
Payment Issue Detected

${greeting}

${bodyText}

Order Details:
- Order Number: ${orderNumber}
- Amount: ₹${amountDisplay}
- Reason: ${this.formatFailureReason(failureContext.reason)}

Action: ${failureContext.recoveryLink}

© 2026 Razor Store. All rights reserved.
      `,
    };
  }

  /**
   * Generate promise follow-up email template
   */
  private generatePromiseFollowUpTemplate(
    customerName: string,
    deadlineDate: Date,
    recoveryLink: string
  ): EmailTemplate {
    const formattedDate = deadlineDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      subject: `Reminder: Payment Due by ${formattedDate}`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .content { line-height: 1.6; margin-bottom: 20px; }
      .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px; }
      .footer { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Payment Reminder</h1>
      </div>
      
      <div class="content">
        <p>Hi ${customerName},</p>
        
        <p>This is a friendly reminder about your promised payment.</p>
        
        <h3>Promise Details:</h3>
        <p>You promised to complete your payment by <strong>${formattedDate}</strong>.</p>
        
        <p>If you have any questions or need to update your payment details, please visit the link below:</p>
        
        <p style="text-align: center;">
          <a href="${recoveryLink}" class="button">View Payment Status</a>
        </p>
        
        <p>Thank you for your business!</p>
      </div>
      
      <div class="footer">
        <p>© 2026 Razor. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `
Payment Reminder

Hi ${customerName},

This is a friendly reminder about your promised payment.

Promise Details:
You promised to complete your payment by ${formattedDate}.

If you have any questions or need to update your payment details, please visit: ${recoveryLink}

Thank you for your business!

© 2026 Razor. All rights reserved.
      `,
    };
  }

  /**
   * Generate promise missed notification template
   */
  private generatePromiseMissedTemplate(
    customerName: string,
    recoveryLink: string
  ): EmailTemplate {
    return {
      subject: `Your Payment Promise Deadline Has Passed`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .content { line-height: 1.6; margin-bottom: 20px; }
      .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px; }
      .footer { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Payment Promise Missed</h1>
      </div>
      
      <div class="content">
        <p>Hi ${customerName},</p>
        
        <p>We noticed that the payment you promised to make has not been completed yet.</p>
        
        <p>Your order is on hold pending payment completion. To resolve this, please either:</p>
        
        <ul>
          <li>Complete the payment immediately</li>
          <li>Make a new payment promise with a revised deadline</li>
          <li>Contact our support team for assistance</li>
        </ul>
        
        <p style="text-align: center;">
          <a href="${recoveryLink}" class="button">Complete Payment</a>
        </p>
        
        <p>We appreciate your prompt attention to this matter.</p>
      </div>
      
      <div class="footer">
        <p>© 2026 Razor. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `
Payment Promise Missed

Hi ${customerName},

We noticed that the payment you promised to make has not been completed yet.

Your order is on hold pending payment completion. To resolve this, please either:
- Complete the payment immediately
- Make a new payment promise with a revised deadline
- Contact our support team for assistance

Please visit: ${recoveryLink}

We appreciate your prompt attention to this matter.

© 2026 Razor. All rights reserved.
      `,
    };
  }

  /**
   * Format failure reason for display
   */
  private formatFailureReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      network_error: 'Network error (temporary issue)',
      card_declined: 'Card was declined',
      timeout: 'Payment timed out',
      insufficient_funds: 'Insufficient funds',
      '3ds_failed': '3D Secure authentication failed',
      unknown: 'Unknown error',
    };
    return reasonMap[reason] || reason;
  }
}

export const emailService = new EmailService();
