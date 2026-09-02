import request from 'supertest';
import express from 'express';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { ttsService } from '../services/TTSService.js';
import { Merchant } from '../models/Merchant.js';
import { createMerchantRouter } from './merchant.js';
import { AuthService } from '../services/AuthService.js';

describe('Merchant Helper Text-to-Speech (Sarvam AI Bulbul v3)', () => {
  let app: express.Express;
  let authService: AuthService;
  let merchant: Merchant;
  let authToken: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const queryRunner = TestDataSource.createQueryRunner();
    await queryRunner.query(`
      TRUNCATE TABLE
        audit_logs, agent_decisions, recommendation_events, recovery_actions,
        recovery_cases, promises_to_pay, order_feedbacks, customer_interactions,
        payment_attempts, payments, order_timeline, recommendations,
        cart_items, carts, order_items, orders,
        inventory, products, customers, merchants
      CASCADE
    `);
    await queryRunner.release();

    const merchantRepo = TestDataSource.getRepository(Merchant);
    merchant = await merchantRepo.save(
      merchantRepo.create({
        id: '22222222-2222-2222-2222-222222222222',
        email: `merchant-tts-${Date.now()}@domain.com`,
        name: 'TTS Test Merchant',
        status: 'active',
      })
    );

    authToken = authService.generateToken({
      id: merchant.id,
      email: merchant.email,
      role: 'merchant',
    });

    app = express();
    app.use(express.json());
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
  });

  describe('TTSService Unit Logic', () => {
    it('1. Cleans visual Markdown markers while preserving numbers and words', () => {
      const input = '**Action:** Discount **50% OFF** applied to product `Power Bank`. Total: **₹1,500.00**.';
      const cleaned = ttsService.cleanTextForSpeech(input);

      expect(cleaned).toBe('Action: Discount 50% OFF applied to product Power Bank. Total: rupees 1,500.00.');
    });

    it('2. Detects "hi-IN" for Devanagari Hindi text', () => {
      const code = ttsService.detectTargetLanguageCode('अभी तक आपके स्टोर पर 2 abandoned carts हैं।');
      expect(code).toBe('hi-IN');
    });

    it('3. Detects "hi-IN" for Hinglish code-mixed text', () => {
      const code = ttsService.detectTargetLanguageCode('Aapke store par filhal 2 abandoned carts hain.');
      expect(code).toBe('hi-IN');
    });

    it('4. Detects "en-IN" for pure English text', () => {
      const code = ttsService.detectTargetLanguageCode('There are currently 2 abandoned carts in your store database.');
      expect(code).toBe('en-IN');
    });

    it('5. NEVER returns Urdu or Urdu language codes', () => {
      const code1 = ttsService.detectTargetLanguageCode('ابھی تک کتنے abandoned carts ہیں');
      const code2 = ttsService.detectTargetLanguageCode('Hello merchant');
      expect(code1).not.toBe('ur-PK');
      expect(code2).not.toBe('ur-PK');
      expect(['hi-IN', 'en-IN']).toContain(code1);
      expect(['hi-IN', 'en-IN']).toContain(code2);
    });
  });

  describe('POST /api/merchant/helper/tts API Endpoint', () => {
    it('6. Rejects unauthenticated request with 401', async () => {
      const response = await request(app)
        .post('/api/merchant/helper/tts')
        .send({ text: 'Hello' });

      expect(response.status).toBe(401);
    });

    it('7. Rejects missing/empty text payload with 400', async () => {
      const response = await request(app)
        .post('/api/merchant/helper/tts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('text is required');
    });

    it('8. Returns valid audio base64 payload for authenticated merchant', async () => {
      const response = await request(app)
        .post('/api/merchant/helper/tts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Namaste! There are 2 abandoned carts.' });

      expect(response.status).toBe(200);
      expect(response.body.audio).toBeDefined();
      expect(typeof response.body.audio).toBe('string');
      expect(response.body.mimeType).toBe('audio/wav');
    });

    it('9. Never exposes SARVAM_API_KEY in endpoint response payload', async () => {
      const response = await request(app)
        .post('/api/merchant/helper/tts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Check security isolation.' });

      expect(response.status).toBe(200);
      const strRes = JSON.stringify(response.body);
      expect(strRes).not.toContain('SARVAM');
      expect(strRes).not.toContain('key');
    });
  });
});
