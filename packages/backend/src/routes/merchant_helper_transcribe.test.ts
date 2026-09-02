import request from 'supertest';
import express from 'express';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { createMerchantRouter } from './merchant.js';
import { AuthService } from '../services/AuthService.js';
import { Merchant } from '../models/Merchant.js';
import { transcriptionService } from '../services/TranscriptionService.js';

describe('Merchant Helper Speech-to-Text Transcription API', () => {
  let app: express.Express;
  let authService: AuthService;
  let merchantToken: string;
  let merchantId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);

    const merchantRepo = TestDataSource.getRepository(Merchant);
    let merchant = await merchantRepo.findOne({ where: { email: 'admin@razorshop.app' } });
    if (!merchant) {
      merchant = await merchantRepo.save(
        merchantRepo.create({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'admin@razorshop.app',
          name: 'Admin Merchant',
          status: 'active',
        })
      );
    }
    merchantId = merchant.id;

    // Generate authenticated merchant JWT token
    merchantToken = authService.generateToken({
      id: merchant.id,
      email: merchant.email,
      role: 'merchant',
    });

    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/merchant/helper/transcribe', () => {
    it('1. Rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .send({ audio: 'data:audio/webm;base64,GkXf' });

      expect(res.status).toBe(401);
    });

    it('2. Rejects request with missing or empty audio data with 400', async () => {
      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Audio data is required');
    });

    it('3. Successfully transcribes audio for authenticated merchant', async () => {
      const mockBase64Audio = 'data:audio/webm;base64,GkXf1234567890';
      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          audio: mockBase64Audio,
          mimeType: 'audio/webm',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      expect(typeof res.body.text).toBe('string');
      expect(res.body.text.length).toBeGreaterThan(0);
    });

    it('4. Preserves Hinglish spoken transcript without auto-translation', async () => {
      const transcribeSpy = jest.spyOn(transcriptionService, 'transcribeAudio').mockResolvedValueOnce(
        'cart 2 ko 70 percent off de do aur 5 minute mein expire kar dena'
      );

      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          audio: 'data:audio/webm;base64,mockHinglishAudioData',
          mimeType: 'audio/webm',
        });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('cart 2 ko 70 percent off de do aur 5 minute mein expire kar dena');
      expect(transcribeSpy).toHaveBeenCalled();
      transcribeSpy.mockRestore();
    });

    it('5. Preserves Hindi spoken transcript', async () => {
      const transcribeSpy = jest.spyOn(transcriptionService, 'transcribeAudio').mockResolvedValueOnce(
        'कार्ट नंबर दो को अस्सी प्रतिशत डिस्काउंट दे दो और पांच मिनट के लिए रखो'
      );

      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          audio: 'data:audio/webm;base64,mockHindiAudioData',
          mimeType: 'audio/webm',
        });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('कार्ट नंबर दो को अस्सी प्रतिशत डिस्काउंट दे दो और पांच मिनट के लिए रखो');
      expect(transcribeSpy).toHaveBeenCalled();
      transcribeSpy.mockRestore();
    });

    it('6. Transcribe request has ZERO side effects on database state', async () => {
      const merchantRepo = TestDataSource.getRepository(Merchant);
      const merchantBefore = await merchantRepo.findOne({ where: { id: merchantId } });

      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          audio: 'data:audio/webm;base64,mockAudioNoSideEffects',
          mimeType: 'audio/webm',
        });

      expect(res.status).toBe(200);
      const merchantAfter = await merchantRepo.findOne({ where: { id: merchantId } });
      expect(merchantAfter?.updated_at).toEqual(merchantBefore?.updated_at);
    });

    it('7. Detects Urdu/Arabic script characters correctly', () => {
      expect(transcriptionService.containsUrduArabicScript('ابھی تک کتنے abandoned carts ہیں')).toBe(true);
      expect(transcriptionService.containsUrduArabicScript('अभी तक कितने abandoned carts हैं')).toBe(false);
      expect(transcriptionService.containsUrduArabicScript('cart 2 ko 80 percent discount de do')).toBe(false);
      expect(transcriptionService.containsUrduArabicScript('How many abandoned carts are there?')).toBe(false);
    });

    it('8. Urdu script output is rejected and retried into Hindi Devanagari', async () => {
      const prevKey = process.env.GROQ_API_KEY;
      const prevLive = process.env.TEST_LIVE_WHISPER;
      process.env.GROQ_API_KEY = 'test-mock-key';
      process.env.TEST_LIVE_WHISPER = 'true';

      const callSpy = jest.spyOn(transcriptionService as any, 'callGroqWhisper')
        .mockResolvedValueOnce('ابھی تک کتنے abandoned carts ہیں')
        .mockResolvedValueOnce('अभी तक कितने abandoned carts हैं');

      const result = await transcriptionService.transcribeAudio({
        audioBase64: 'data:audio/webm;base64,mockUrduAudio',
        mimeType: 'audio/webm',
      });

      expect(result).toBe('अभी तक कितने abandoned carts हैं');
      expect(transcriptionService.containsUrduArabicScript(result)).toBe(false);
      expect(callSpy).toHaveBeenCalledTimes(2);
      callSpy.mockRestore();
      process.env.GROQ_API_KEY = prevKey;
      process.env.TEST_LIVE_WHISPER = prevLive;
    });

    it('9. Preserves business terminology and numbers in transcripts', async () => {
      const transcribeSpy = jest.spyOn(transcriptionService, 'transcribeAudio').mockResolvedValueOnce(
        'cart 2 ko 90% discount de do for 5 minutes'
      );

      const res = await request(app)
        .post('/api/merchant/helper/transcribe')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          audio: 'data:audio/webm;base64,mockBusinessTermsAudio',
          mimeType: 'audio/webm',
        });

      expect(res.status).toBe(200);
      expect(res.body.text).toContain('cart 2');
      expect(res.body.text).toContain('90% discount');
      expect(res.body.text).toContain('5 minutes');
      transcribeSpy.mockRestore();
    });
  });
});
