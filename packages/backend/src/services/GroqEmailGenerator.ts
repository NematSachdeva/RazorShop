import { env } from '../config/env.js';

export interface GeneratedEmailBody {
  subject: string;
  greeting: string;
  body: string;
  call_to_action?: string;
  refund_note?: string;
}

export interface GroqEmailFactContext {
  customerName: string;
  orderNumber: string;
  orderAmountDisplay: string;
  status: string;
  eventType: 'cancellation' | 'return_update' | 'refund_initiated';
  reason?: string;
  rejectionReason?: string;
  refundAmountDisplay?: string;
  paymentMethodWording?: string;
  pickupNotes?: string;
}

export interface GroqPromotionalDealFactContext {
  customerName: string;
  productName: string;
  originalPriceDisplay: string;
  dealPriceDisplay: string;
  discountPercent: number;
  dealExpiresInDays?: number;
}

/**
  Groq AI Service for natural-language order lifecycle, return/cancellation, and promotional deal email generation.
  Strictly uses authoritative factual metadata provided by backend system.
 */
export class GroqEmailGenerator {
  private static readonly MODEL = 'openai/gpt-oss-120b';
  private static readonly FALLBACK_MODEL = 'openai/gpt-oss-20b';

  async generatePromotionalDealEmail(context: GroqPromotionalDealFactContext): Promise<GeneratedEmailBody> {
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;

    if (!apiKey || apiKey === 'placeholder-groq-key' || process.env.NODE_ENV === 'test') {
      return this.getPromotionalFallbackContent(context);
    }

    const systemPrompt = `You are a professional e-commerce marketing assistant for RazorShop.
Write a concise, compelling customer promotional email in ENGLISH for an exclusive limited-time offer.
Base all content STRICTLY on the authoritative facts below. DO NOT alter product names, prices, or discount percentages.
Return ONLY valid JSON matching this exact structure:
{
  "subject": "Exclusive Offer: Special Deal on Product Name!",
  "greeting": "Hi CustomerName,",
  "body": "Natural-language English promotional email body explaining the offer clearly.",
  "call_to_action": "Claim Deal Now"
}`;

    const userPrompt = `AUTHORITATIVE SYSTEM FACTS (MUST NOT BE ALTERED):
- Customer Name: ${context.customerName || 'Valued Customer'}
- Product Name: ${context.productName}
- Original Price: ₹${context.originalPriceDisplay}
- Discount Percent: ${context.discountPercent}%
- Exclusive Deal Price: ₹${context.dealPriceDisplay}
${context.dealExpiresInDays ? `- Offer Valid For: ${context.dealExpiresInDays} days` : ''}`;

    for (const model of [GroqEmailGenerator.MODEL, GroqEmailGenerator.FALLBACK_MODEL]) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 450,
            response_format: { type: 'json_object' },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const rawText = data.choices?.[0]?.message?.content;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.subject && parsed.body) {
              return {
                subject: parsed.subject,
                greeting: parsed.greeting || `Hi ${context.customerName || 'Valued Customer'},`,
                body: parsed.body,
                call_to_action: parsed.call_to_action || 'Complete Purchase Now',
              };
            }
          }
        }
      } catch (err) {
        console.warn(`[GroqEmailGenerator] Groq API promotional call failed for model ${model}, fallback used:`, err);
      }
    }

    return this.getPromotionalFallbackContent(context);
  }

  private getPromotionalFallbackContent(context: GroqPromotionalDealFactContext): GeneratedEmailBody {
    const custName = context.customerName || 'Valued Customer';
    return {
      subject: `Special ${context.discountPercent}% Off Offer on ${context.productName}!`,
      greeting: `Hi ${custName},`,
      body: `We noticed you were interested in ${context.productName}. For a limited time, we are offering an exclusive ${context.discountPercent}% discount! You can now get ${context.productName} for just ₹${context.dealPriceDisplay} (Original Price: ₹${context.originalPriceDisplay}).${context.dealExpiresInDays ? ` Hurry, this offer expires in ${context.dealExpiresInDays} days!` : ''}`,
      call_to_action: 'Get Deal Now',
    };
  }

  async generateEmail(context: GroqEmailFactContext): Promise<GeneratedEmailBody> {
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;

    if (!apiKey || apiKey === 'placeholder-groq-key' || process.env.NODE_ENV === 'test') {
      return this.getFallbackContent(context);
    }

    const systemPrompt = `You are a professional, friendly e-commerce support assistant for RazorShop.
Write a concise, polite customer email for an order update based STRICTLY on the authoritative facts provided below.
DO NOT invent or alter order numbers, prices, refund amounts, customer names, or status terms.
Return ONLY valid JSON matching this exact structure:
{
  "subject": "Email subject line",
  "greeting": "Hi CustomerName,",
  "body": "Natural-language email body explaining the exact status update concisely.",
  "refund_note": "Reassurance message regarding source payment refund (5-7 business days) if applicable",
  "call_to_action": "View Order Status"
}`;

    const userPrompt = `AUTHORITATIVE SYSTEM FACTS (DO NOT INVENT DIFFERENT FACTS):
- Event Type: ${context.eventType}
- Current Status: ${context.status}
- Customer Name: ${context.customerName}
- Order Number: ${context.orderNumber}
- Order Total Amount: ₹${context.orderAmountDisplay}
${context.reason ? `- Reason: ${context.reason}` : ''}
${context.rejectionReason ? `- Rejection Reason: ${context.rejectionReason}` : ''}
${context.refundAmountDisplay ? `- Refund Amount: ₹${context.refundAmountDisplay}` : ''}
${context.paymentMethodWording ? `- Payment Method Wording: ${context.paymentMethodWording}` : ''}
${context.pickupNotes ? `- Pickup Courier Notes: ${context.pickupNotes}` : ''}`;

    for (const model of [GroqEmailGenerator.MODEL, GroqEmailGenerator.FALLBACK_MODEL]) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 450,
            response_format: { type: 'json_object' },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const rawText = data.choices?.[0]?.message?.content;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.subject && parsed.body) {
              return {
                subject: parsed.subject,
                greeting: parsed.greeting || `Hi ${context.customerName},`,
                body: parsed.body,
                refund_note: parsed.refund_note,
                call_to_action: parsed.call_to_action || 'View Order Details',
              };
            }
          }
        }
      } catch (err) {
        console.warn(`[GroqEmailGenerator] Groq API call failed for model ${model}, fallback used:`, err);
      }
    }

    return this.getFallbackContent(context);
  }

  private getFallbackContent(context: GroqEmailFactContext): GeneratedEmailBody {
    const formattedStatus = context.status.replace(/_/g, ' ').toUpperCase();

    if (context.eventType === 'cancellation') {
      return {
        subject: `Your RazorShop Order #${context.orderNumber} Has Been Cancelled`,
        greeting: `Hi ${context.customerName || 'Valued Customer'},`,
        body: `Your order #${context.orderNumber} for ₹${context.orderAmountDisplay} has been cancelled${context.reason ? ` (Reason: ${context.reason})` : ''}.`,
        refund_note: `The amount of ₹${context.refundAmountDisplay || context.orderAmountDisplay} will be refunded to your original payment method within 5–7 days.`,
        call_to_action: 'View Order Details',
      };
    }

    if (context.eventType === 'refund_initiated') {
      return {
        subject: `Refund Initiated for RazorShop Order #${context.orderNumber}`,
        greeting: `Hi ${context.customerName || 'Valued Customer'},`,
        body: `Great news! Your refund for Order #${context.orderNumber} has been initiated by the seller following the successful return inspection.`,
        refund_note: `Your refund of ₹${context.refundAmountDisplay || context.orderAmountDisplay} has been initiated to your source payment method. The amount should reflect in your account within 5–7 days.`,
        call_to_action: 'Check Refund Status',
      };
    }

    // Default return update fallback
    return {
      subject: `Return Update: ${formattedStatus} for Order #${context.orderNumber}`,
      greeting: `Hi ${context.customerName || 'Valued Customer'},`,
      body: `Your return request for Order #${context.orderNumber} has been updated to ${formattedStatus}.${context.reason ? ` Reason: ${context.reason}` : ''}${context.rejectionReason ? ` Rejection Reason: ${context.rejectionReason}` : ''}${context.pickupNotes ? ` Pickup Notes: ${context.pickupNotes}` : ''}`,
      call_to_action: 'View Return Details',
    };
  }
}

export const groqEmailGenerator = new GroqEmailGenerator();
