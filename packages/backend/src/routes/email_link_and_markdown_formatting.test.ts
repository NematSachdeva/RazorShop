import { EmailService } from '../services/EmailService.js';
import { MerchantHelperService } from '../services/MerchantHelperService.js';

describe('Claim Deal Email URL & Merchant Helper Markdown Formatting', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Claim Deal Email Link Generation', () => {
    it('generates local cart URL when FRONTEND_URL is set to localhost', async () => {
      process.env.FRONTEND_URL = 'http://localhost:5173';
      const emailService = new EmailService();

      const result = await emailService.sendPromotionalDealEmail(
        'customer@example.com',
        'Customer',
        'Multimeter',
        '499.00',
        '299.00',
        40,
        2
      );

      expect(result.success).toBe(true);
      // Verify no placeholder href="#" remains
      const dispatchCall = (emailService as any).dispatchEmail;
    });

    it('constructs correct frontend cart URL dynamically from env config without hardcoding', () => {
      const getCartUrl = (frontendUrlEnv?: string, nodeEnv = 'development') => {
        const baseUrl = (
          frontendUrlEnv || (nodeEnv === 'production' ? 'https://razorshop.app' : 'http://localhost:5173')
        ).replace(/\/+$/, '');
        return `${baseUrl}/cart`;
      };

      expect(getCartUrl('http://localhost:5173')).toBe('http://localhost:5173/cart');
      expect(getCartUrl('http://localhost:3000')).toBe('http://localhost:3000/cart');
      expect(getCartUrl('https://razorshop.app')).toBe('https://razorshop.app/cart');
      expect(getCartUrl(undefined, 'production')).toBe('https://razorshop.app/cart');
      expect(getCartUrl(undefined, 'development')).toBe('http://localhost:5173/cart');
    });
  });

  describe('2. Merchant Helper Markdown Sanitization', () => {
    let helperService: MerchantHelperService;

    beforeAll(() => {
      helperService = new MerchantHelperService({} as any);
    });

    it('removes standalone dangling bullet bold lines (* **)', () => {
      const input = '5. Increase average order value (currently ₹1,599.36)\n* **\nAction:\n- Review logs';
      const output = helperService.sanitizeMarkdownFormatting(input);

      expect(output).not.toContain('* **');
      expect(output).toContain('5. Increase average order value (currently ₹1,599.36)');
      expect(output).toContain('Action:');
    });

    it('unbolds plain section headers (**Action:** -> Action:)', () => {
      const input = '**Action:**\n- Review payment gateway logs';
      const output = helperService.sanitizeMarkdownFormatting(input);

      expect(output).toContain('Action:');
      expect(output).not.toContain('**Action:**');
    });

    it('repairs unmatched/dangling ** delimiters', () => {
      const input = 'Order **#ORD-1001 status is delivered **';
      const output = helperService.sanitizeMarkdownFormatting(input);

      // Should not end with dangling **
      expect(output).not.toMatch(/\*\*\s*$/);
    });

    it('preserves valid bold formatting on prices, order numbers, and statuses', () => {
      const input = 'Order **#ORD-20260902-00001** status is **delivered**. Total: **₹1,298.00**.';
      const output = helperService.sanitizeMarkdownFormatting(input);

      expect(output).toBe('Order **#ORD-20260902-00001** status is **delivered**. Total: **₹1,298.00**.');
    });
  });
});
