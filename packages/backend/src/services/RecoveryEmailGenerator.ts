import { env } from '../config/env.js';

export interface RecoveryEmailContent {
  subject: string;
  greeting: string;
  body: string;
  call_to_action: string;
  tone: string;
}

export interface GeneratorContext {
  customerName: string;
  orderNumber: string;
  amountDisplay: string;
  failureReason: string;
  recoveryUrl: string;
}

/**
 * Service to generate personalized payment recovery email content using Groq AI.
 * Strictly uses GROQ API with fallback to deterministic email template.
 */
export class RecoveryEmailGenerator {
  private static readonly MODEL = 'openai/gpt-oss-120b';
  private static readonly FALLBACK_MODEL = 'openai/gpt-oss-20b';

  async generateEmailContent(context: GeneratorContext): Promise<RecoveryEmailContent> {
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;

    if (!apiKey || apiKey === 'placeholder-groq-key') {
      return this.getFallbackContent(context);
    }

    const systemPrompt = `You are a helpful, professional e-commerce customer support assistant for Razor Store.
Draft a concise, polite payment failure recovery email content for a customer whose payment just failed.
Return ONLY valid JSON matching this exact structure:
{
  "subject": "Email subject string",
  "greeting": "Personalized greeting",
  "body": "Clear body text explaining payment failure and reassurance",
  "call_to_action": "Action button text",
  "tone": "helpful"
}`;

    const userPrompt = `Customer Name: ${context.customerName}
Order Number: ${context.orderNumber}
Discounted Order Amount: ₹${context.amountDisplay}
Failure Reason: ${context.failureReason}
Recovery Action URL: ${context.recoveryUrl}`;

    for (const model of [RecoveryEmailGenerator.MODEL, RecoveryEmailGenerator.FALLBACK_MODEL]) {
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
            max_tokens: 400,
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
                call_to_action: parsed.call_to_action || 'Complete Payment',
                tone: 'helpful',
              };
            }
          }
        }
      } catch (err) {
        console.warn(`[RecoveryEmailGenerator] Groq API model ${model} failed, using fallback:`, err);
      }
    }

    return this.getFallbackContent(context);
  }

  private getFallbackContent(context: GeneratorContext): RecoveryEmailContent {
    return {
      subject: `Your payment for Order ${context.orderNumber} needs attention`,
      greeting: `Hi ${context.customerName || 'Valued Customer'},`,
      body: `We noticed that your payment for Order ${context.orderNumber} (Amount: ₹${context.amountDisplay}) could not be completed (${context.failureReason}). Your order items remain safely reserved.`,
      call_to_action: `Complete Payment`,
      tone: `helpful`,
    };
  }
}

export const recoveryEmailGenerator = new RecoveryEmailGenerator();
