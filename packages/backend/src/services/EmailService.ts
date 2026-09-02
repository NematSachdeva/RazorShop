import { Resend } from 'resend';
import { env } from '../config/env.js';
import { groqEmailGenerator } from './GroqEmailGenerator.js';

export interface EmailOptions {
  source?: 'customer' | 'system' | 'merchant';
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
 * Handles all email communication for payment recovery and confirmation workflows.
 * 
 * TWO-MODE DELIVERY ARCHITECTURE:
 * 1. TEST MODE (EMAIL_DELIVERY_MODE=mock):
 *    - Active during automated tests or when EMAIL_DELIVERY_MODE=mock.
 *    - Suppresses Resend network calls, returns deterministic mock message ID (msg_mock_<timestamp>).
 *    - Zero external API requests or quota consumption.
 * 
 * 2. LIVE MODE (EMAIL_DELIVERY_MODE=live):
 *    - Active when running application with EMAIL_DELIVERY_MODE=live.
 *    - Sends real email via Resend API directly to the customer's email address stored in PostgreSQL.
 *    - No redirection or recipient override.
 */
export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(fromEmailOverride?: string) {
    this.fromEmail =
      fromEmailOverride ||
      env.RESEND_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      'nemat@razorshop.app';

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
   * Check if email service is available (API key configured)
   */
  isAvailable(): boolean {
    return this.resend !== null && !!env.RESEND_API_KEY;
  }

  /**
   * Dispatches email in either MOCK or LIVE mode based strictly on EMAIL_DELIVERY_MODE and test environment.
   */
  private async dispatchEmail(
    toRecipient: string,
    template: EmailTemplate,
    source: string = 'customer'
  ): Promise<EmailResult> {
    if (!toRecipient || !toRecipient.includes('@')) {
      console.warn(`[EmailService] Customer email missing or invalid: ${toRecipient}`);
      return {
        success: false,
        error: 'Customer email missing or invalid',
      };
    }

    const isTest =
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined;

    // Test environment always forces mock mode regardless of .env configuration
    const effectiveMode = isTest ? 'mock' : env.EMAIL_DELIVERY_MODE;

    if (effectiveMode === 'mock') {
      console.log(`[Email] mode=test transport=mock source=${source} recipient=${toRecipient}`);
      console.log('[Email] MOCK: Resend request suppressed');
      return {
        success: true,
        messageId: `msg_mock_${Date.now()}`,
      };
    }

    // LIVE APPLICATION MODE — Call Resend API directly with the customer's email from PostgreSQL
    console.log(`[Email] mode=application transport=resend source=${source} recipient=${toRecipient}`);

    if (!this.resend) {
      console.error('[Email] Cannot send email via Resend: client uninitialized or RESEND_API_KEY missing');
      return {
        success: false,
        error: 'Email service uninitialized (RESEND_API_KEY missing)',
      };
    }

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: toRecipient,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      if (response.error || !response.data?.id) {
        const errorMsg = response.error?.message || 'Failed to send email via Resend';
        console.error(`[Email] Resend failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      console.log(`[Email] Resend accepted message: ${response.data.id}`);
      return { success: true, messageId: response.data.id };
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Email] Resend failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
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
    const template = this.generateRecoveryEmailTemplate(
      customerName,
      orderNumber,
      failureContext,
      customContent
    );
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
  }

  /**
   * Send payment confirmation email for successfully captured payments.
   */
  async sendPromotionalDealEmail(
    customerEmail: string,
    customerName: string,
    productName: string,
    originalPriceDisplay: string,
    dealPriceDisplay: string,
    discountPercent: number,
    dealExpiresInDays?: number,
    options?: EmailOptions
  ): Promise<EmailResult> {
    const generated = await groqEmailGenerator.generatePromotionalDealEmail({
      customerName,
      productName,
      originalPriceDisplay,
      dealPriceDisplay,
      discountPercent,
      dealExpiresInDays,
    });

    const template: EmailTemplate = {
      subject: generated.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Special Offer for You!</h2>
          <p>${generated.greeting}</p>
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">${generated.body}</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0; font-weight: bold; color: #1f2937;">Product: ${productName}</p>
            <p style="margin: 5px 0 0 0; color: #4b5563;">Original Price: <span style="text-decoration: line-through;">₹${originalPriceDisplay}</span></p>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #059669;">Special Deal Price: ₹${dealPriceDisplay} (${discountPercent}% OFF)</p>
          </div>
          <a href="#" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-align: center;">${generated.call_to_action || 'Shop Now'}</a>
        </div>
      `,
      text: `${generated.greeting}\n\n${generated.body}\n\nProduct: ${productName}\nOriginal Price: ₹${originalPriceDisplay}\nDeal Price: ₹${dealPriceDisplay} (${discountPercent}% OFF)`,
    };

    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
  }

  /**
   * Send notification when payment confirmation is complete
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
    const template = this.renderPaymentConfirmationTemplate(customerName, orderNumber, details);
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
  }

  /**
   * Send notification when an order is dispatched by the merchant
   */
  async sendOrderDispatchedNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      orderDate: string;
      shippingAddress?: {
        full_address: string;
        state: string;
        pin_code: string;
        phone?: string;
      } | null;
      items: Array<{
        name: string;
        quantity: number;
        lineTotalCents: number;
      }>;
      totalCents: number;
      orderLink: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    const template = this.renderOrderDispatchedTemplate(customerName, orderNumber, details);
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
  }

  /**
   * Send notification when an order is marked as delivered
   */
  async sendOrderDeliveredNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      deliveredDate: string;
      items: Array<{
        name: string;
        quantity: number;
        lineTotalCents: number;
      }>;
      totalCents: number;
      orderLink: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    const template = this.renderOrderDeliveredTemplate(customerName, orderNumber, details);
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
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
    const template = this.generatePromiseFollowUpTemplate(customerName, deadlineDate, recoveryLink);
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
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
    const template = this.generatePromiseMissedTemplate(customerName, recoveryLink);
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
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
            ${
              details.discountCents > 0
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
   * Render Order Dispatched HTML/Text Template
   */
  private renderOrderDispatchedTemplate(
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      orderDate: string;
      shippingAddress?: {
        full_address: string;
        state: string;
        pin_code: string;
        phone?: string;
      } | null;
      items: Array<{
        name: string;
        quantity: number;
        lineTotalCents: number;
      }>;
      totalCents: number;
      orderLink: string;
    }
  ): EmailTemplate {
    const addressStr = details.shippingAddress
      ? `${details.shippingAddress.full_address}, ${details.shippingAddress.state} - ${details.shippingAddress.pin_code}`
      : 'Address on file';

    const itemsSummary = details.items
      .map((item) => `- ${item.name} x${item.quantity} (₹${(item.lineTotalCents / 100).toFixed(2)})`)
      .join('\n');

    return {
      subject: `Your RazorShop order #${orderNumber} has been dispatched`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
      .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .badge { display: inline-block; background: #3b82f6; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 14px; }
      .info-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold; }
      .footer { font-size: 12px; color: #64748b; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">🚚 Order Dispatched!</h1>
        <p style="margin:5px 0 0 0; opacity: 0.9;">Order #${orderNumber}</p>
      </div>

      <div class="content">
        <p>Hi <strong>${customerName}</strong>,</p>

        <p>Good news! Your RazorShop order <strong>#${orderNumber}</strong> has been dispatched and is now on its way to you.</p>

        <div class="info-box">
          <span class="badge">Status: DISPATCHED</span>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
            <strong>Expected Delivery:</strong> Approximately 3–5 days<br/>
            <strong>Delivery Address:</strong> ${addressStr}
          </p>
        </div>

        <p>You can view your order and track its status anytime from your RazorShop account.</p>

        <p style="text-align: center;">
          <a href="${details.orderLink}" class="button">Track Order Status</a>
        </p>
      </div>

      <div class="footer">
        <p>© 2026 RazorShop. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `
Good news! Your RazorShop order #${orderNumber} has been dispatched and is now on its way to you.

Status: DISPATCHED
Expected Delivery: Approximately 3–5 days
Delivery Address: ${addressStr}

Items Summary:
${itemsSummary}

Track Order: ${details.orderLink}

© 2026 RazorShop. All rights reserved.
      `,
    };
  }

  /**
   * Render Order Delivered HTML/Text Template
   */
  private renderOrderDeliveredTemplate(
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      deliveredDate: string;
      items: Array<{
        name: string;
        quantity: number;
        lineTotalCents: number;
      }>;
      totalCents: number;
      orderLink: string;
    }
  ): EmailTemplate {
    return {
      subject: `Your RazorShop order #${orderNumber} has been delivered`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
      .header { background: #9333ea; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .badge { display: inline-block; background: #a855f7; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 14px; }
      .info-box { background: #faf5ff; border: 1px solid #e9d5ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .button { display: inline-block; background: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold; }
      .footer { font-size: 12px; color: #64748b; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">🎉 Order Delivered!</h1>
        <p style="margin:5px 0 0 0; opacity: 0.9;">Order #${orderNumber}</p>
      </div>

      <div class="content">
        <p>Hi <strong>${customerName}</strong>,</p>

        <p>Your RazorShop order <strong>#${orderNumber}</strong> was delivered on <strong>${details.deliveredDate}</strong>.</p>

        <p>We hope everything arrived safely and that you enjoy your purchase!</p>

        <div class="info-box">
          <span class="badge">Status: DELIVERED</span>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b21a8;">
            Thank you for shopping with RazorShop. We really appreciate your business!
          </p>
        </div>

        <p>We'd love to hear about your experience. You can leave feedback or review your order from your account.</p>

        <p style="text-align: center;">
          <a href="${details.orderLink}" class="button">View Order & Leave Feedback</a>
        </p>

        <p>We look forward to serving you again soon.</p>
      </div>

      <div class="footer">
        <p>© 2026 RazorShop. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `
Your RazorShop order #${orderNumber} was delivered on ${details.deliveredDate}.

We hope everything arrived safely and that you enjoy your purchase.

Thank you for shopping with RazorShop. We really appreciate your business.

We'd love to hear about your experience. You can leave feedback from your RazorShop account: ${details.orderLink}

We look forward to serving you again.

© 2026 RazorShop. All rights reserved.
      `,
    };
  }

  /**
   * Send notification when an order is cancelled
   */
  async sendOrderCancelledNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      amountCents: number;
      reason: string;
      orderLink?: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    const formattedAmount = (details.amountCents / 100).toFixed(2);
    
    // Generate AI natural-language content strictly using authoritative facts
    const aiContent = await groqEmailGenerator.generateEmail({
      customerName,
      orderNumber,
      orderAmountDisplay: formattedAmount,
      status: 'CANCELLED',
      eventType: 'cancellation',
      reason: details.reason,
      refundAmountDisplay: formattedAmount,
      paymentMethodWording: 'Original source payment method',
    });

    const template: EmailTemplate = {
      subject: aiContent.subject,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
      .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 14px; }
      .info-box { background: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .footer { font-size: 12px; color: #64748b; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">Order Cancelled</h1>
        <p style="margin:5px 0 0 0; opacity: 0.9;">Order #${orderNumber}</p>
      </div>

      <div class="content">
        <p>${aiContent.greeting}</p>
        <p>${aiContent.body}</p>

        <div class="info-box">
          <span class="badge">Status: CANCELLED</span>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #991b1b;">
            <strong>Cancellation Reason:</strong> ${details.reason}<br/>
            <strong>Refund Amount:</strong> ₹${formattedAmount}<br/>
            <strong>Refund Destination:</strong> Original payment method<br/>
            <strong>Expected Timeline:</strong> 5–7 business days
          </p>
        </div>

        <p>${aiContent.refund_note || `The amount of ₹${formattedAmount} will be refunded to your original payment method within 5–7 days.`}</p>
      </div>

      <div class="footer">
        <p>© 2026 RazorShop. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `${aiContent.subject}\n\n${aiContent.greeting}\n\n${aiContent.body}\n\nCancellation Reason: ${details.reason}\nRefund Amount: ₹${formattedAmount}\nRefund Destination: Original payment method\nExpected Timeline: 5–7 business days\n\n${aiContent.refund_note || `The amount of ₹${formattedAmount} will be refunded to your original payment method within 5–7 days.`}\n\n© 2026 RazorShop. All rights reserved.`,
    };
    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
  }

  /**
   * Send notification for return status updates
   */
  async sendReturnStatusNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      status: string;
      reason?: string;
      rejectionReason?: string;
      notes?: string;
      orderLink?: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    const statusTitles: Record<string, { title: string; subject: string; color: string }> = {
      RETURN_REQUESTED: {
        title: 'Return Requested',
        subject: `Return Requested for RazorShop Order #${orderNumber}`,
        color: '#d97706',
      },
      RETURN_APPROVED: {
        title: 'Return Approved',
        subject: `Return Approved for RazorShop Order #${orderNumber}`,
        color: '#2563eb',
      },
      RETURN_REJECTED: {
        title: 'Return Rejected',
        subject: `Return Request Update for RazorShop Order #${orderNumber}`,
        color: '#dc2626',
      },
      PICKUP_SCHEDULED: {
        title: 'Pickup Scheduled',
        subject: `Pickup Scheduled for Returned Order #${orderNumber}`,
        color: '#0284c7',
      },
      ORDER_PICKED_UP: {
        title: 'Order Picked Up',
        subject: `Returned Order #${orderNumber} Picked Up`,
        color: '#7c3aed',
      },
      RETURN_IN_TRANSIT: {
        title: 'Return In Transit',
        subject: `Returned Order #${orderNumber} is In Transit`,
        color: '#4f46e5',
      },
      ORDER_RETURNED_TO_SELLER: {
        title: 'Returned to Seller',
        subject: `Return Process Complete for Order #${orderNumber}`,
        color: '#16a34a',
      },
    };

    const statusConfig = statusTitles[details.status] || {
      title: details.status.replace(/_/g, ' '),
      subject: `Return Update for Order #${orderNumber}`,
      color: '#2563eb',
    };

    const aiContent = await groqEmailGenerator.generateEmail({
      customerName,
      orderNumber,
      orderAmountDisplay: '0.00',
      status: details.status,
      eventType: 'return_update',
      reason: details.reason,
      rejectionReason: details.rejectionReason,
      pickupNotes: details.notes,
    });

    const template: EmailTemplate = {
      subject: aiContent.subject || statusConfig.subject,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
      .header { background: ${statusConfig.color}; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .badge { display: inline-block; background: ${statusConfig.color}; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 14px; }
      .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .footer { font-size: 12px; color: #64748b; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">${statusConfig.title}</h1>
        <p style="margin:5px 0 0 0; opacity: 0.9;">Order #${orderNumber}</p>
      </div>

      <div class="content">
        <p>${aiContent.greeting}</p>
        <p>${aiContent.body}</p>

        <div class="info-box">
          <span class="badge">Status: ${statusConfig.title}</span>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #334155;">
            ${details.reason ? `<strong>Return Reason:</strong> ${details.reason}<br/>` : ''}
            ${details.rejectionReason ? `<strong>Rejection Reason:</strong> ${details.rejectionReason}<br/>` : ''}
            ${details.notes ? `<strong>Notes:</strong> ${details.notes}<br/>` : ''}
            <strong>Updated Date:</strong> ${new Date().toLocaleString()}
          </p>
        </div>

        ${
          details.status === 'RETURN_REJECTED'
            ? `<p>If you have any questions regarding your return rejection, please contact customer support.</p>`
            : details.status === 'ORDER_RETURNED_TO_SELLER'
            ? `<p>The return process for order #${orderNumber} is now complete. Thank you for your patience!</p>`
            : `<p>We will keep you updated as your return progresses through logistics.</p>`
        }
      </div>

      <div class="footer">
        <p>© 2026 RazorShop. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `${aiContent.subject}\n\n${aiContent.greeting}\n\n${aiContent.body}\n\nStatus: ${statusConfig.title}\n${details.reason ? `Reason: ${details.reason}\n` : ''}${details.rejectionReason ? `Rejection Reason: ${details.rejectionReason}\n` : ''}${details.notes ? `Notes: ${details.notes}\n` : ''}\n© 2026 RazorShop. All rights reserved.`,
    };

    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
  }

  /**
   * Send notification when a refund is initiated for a returned order
   */
  async sendRefundInitiatedNotification(
    customerEmail: string,
    customerName: string,
    orderNumber: string,
    details: {
      orderId: string;
      refundAmountCents: number;
      paymentSource?: string;
      orderLink?: string;
    },
    options?: EmailOptions
  ): Promise<EmailResult> {
    const formattedAmount = (details.refundAmountCents / 100).toFixed(2);

    const aiContent = await groqEmailGenerator.generateEmail({
      customerName,
      orderNumber,
      orderAmountDisplay: formattedAmount,
      status: 'REFUND_INITIATED',
      eventType: 'refund_initiated',
      refundAmountDisplay: formattedAmount,
      paymentMethodWording: details.paymentSource || 'Original source payment method',
    });

    const template: EmailTemplate = {
      subject: aiContent.subject,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
      .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .badge { display: inline-block; background: #22c55e; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 14px; }
      .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .footer { font-size: 12px; color: #64748b; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">Refund Initiated</h1>
        <p style="margin:5px 0 0 0; opacity: 0.9;">Order #${orderNumber}</p>
      </div>

      <div class="content">
        <p>${aiContent.greeting}</p>
        <p>${aiContent.body}</p>

        <div class="info-box">
          <span class="badge">Status: REFUND INITIATED</span>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #166534;">
            <strong>Refund Amount:</strong> ₹${formattedAmount}<br/>
            <strong>Payment Method:</strong> ${details.paymentSource || 'Source payment method'}<br/>
            <strong>Expected Timeline:</strong> 5–7 business days
          </p>
        </div>

        <p>${aiContent.refund_note || `Your refund of ₹${formattedAmount} has been initiated to your source payment method. The amount should reflect in your account within 5–7 days.`}</p>
      </div>

      <div class="footer">
        <p>© 2026 RazorShop. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
      `,
      text: `${aiContent.subject}\n\n${aiContent.greeting}\n\n${aiContent.body}\n\nRefund Amount: ₹${formattedAmount}\nPayment Method: ${details.paymentSource || 'Source payment method'}\nExpected Timeline: 5–7 business days\n\n${aiContent.refund_note || `Your refund of ₹${formattedAmount} has been initiated to your source payment method. The amount should reflect in your account within 5–7 days.`}\n\n© 2026 RazorShop. All rights reserved.`,
    };

    return await this.dispatchEmail(customerEmail, template, options?.source || 'customer');
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
