import express, { Express } from 'express';
import request from 'supertest';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { AuthService } from '../services/AuthService.js';
import { seedDatabase } from '../seed.js';
import { createAuthRouter } from './auth.js';
import { createMerchantRouter } from './merchant.js';
import { createAdminRouter } from './admin.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

describe('Merchant Onboarding & Admin Approval System Tests', () => {
  let app: Express;
  let authService: AuthService;

  beforeAll(async () => {
    await initializeTestDatabase();
    await seedDatabase(TestDataSource);

    authService = new AuthService(TestDataSource);

    app = express();
    app.use(express.json());

    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    app.use('/api/admin', createAdminRouter(TestDataSource, authService));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('1. Merchant registration creates a pending application and timeline event', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'applicant.merchant@example.com',
        password: 'password123',
        name: 'Applicant Owner',
        role: 'merchant',
        business_name: 'Apex Artisans',
        phone: '+919999988888',
        reason: 'We want to sell handmade leather goods on Razor.',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toHaveProperty('token');
    expect(registerRes.body.role).toBe('merchant');
    expect(registerRes.body.application_status).toBe('pending');
    expect(registerRes.body).toHaveProperty('application_id');
  });

  test('2. Pending merchant is denied access to merchant dashboard (HTTP 403)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'applicant.merchant@example.com', password: 'password123' });

    expect(loginRes.status).toBe(200);
    const pendingToken = loginRes.body.token;

    const dashRes = await request(app)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${pendingToken}`);

    expect(dashRes.status).toBe(403);
    expect(dashRes.body.error).toContain('pending');
  });

  test('3. Applicant can retrieve application status and timeline', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'applicant.merchant@example.com', password: 'password123' });

    const token = loginRes.body.token;

    const statusRes = await request(app)
      .get('/api/merchant/application-status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.email).toBe('applicant.merchant@example.com');
    expect(statusRes.body.business_name).toBe('Apex Artisans');
    expect(statusRes.body.status).toBe('pending');
    expect(Array.isArray(statusRes.body.timeline)).toBe(true);
    expect(statusRes.body.timeline.length).toBeGreaterThanOrEqual(1);
    expect(statusRes.body.timeline[0].event_type).toBe('APPLICATION_SUBMITTED');
  });

  test('4. Public admin self-registration is prohibited (HTTP 403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'attacker@example.com',
        password: 'password123',
        role: 'admin',
      });

    expect(res.status).toBe(403);
  });

  test('5. Non-admin user is denied access to admin endpoints (HTTP 403)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'applicant.merchant@example.com', password: 'password123' });

    const token = loginRes.body.token;

    const adminRes = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(adminRes.status).toBe(403);
  });

  test('6. Admin can log in with ADMIN_EMAIL and access admin summary & applications list', async () => {
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: env.ADMIN_EMAIL, password: 'password123' });

    expect(adminLoginRes.status).toBe(200);
    expect(adminLoginRes.body.role).toBe('admin');
    const adminToken = adminLoginRes.body.token;

    const summaryRes = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body).toHaveProperty('pending_count');
    expect(summaryRes.body).toHaveProperty('approved_count');

    const appsRes = await request(app)
      .get('/api/admin/applications?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(appsRes.status).toBe(200);
    expect(Array.isArray(appsRes.body.applications)).toBe(true);
  });

  test('7. Admin approval enables merchant dashboard access and records APPROVED timeline event', async () => {
    // 1. Admin login
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: env.ADMIN_EMAIL, password: 'password123' });
    const adminToken = adminLogin.body.token;

    // 2. Fetch pending application ID
    const statusRes = await request(app)
      .get('/api/merchant/application-status')
      .set('Authorization', `Bearer ${(await request(app).post('/api/auth/login').send({ email: 'applicant.merchant@example.com', password: 'password123' })).body.token}`);
    const appId = statusRes.body.id;

    // 3. Approve application
    const approveRes = await request(app)
      .post(`/api/admin/applications/${appId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');
    expect(approveRes.body.timeline.some((t: any) => t.event_type === 'APPROVED')).toBe(true);

    // 4. Verify approved merchant now accesses merchant dashboard (HTTP 200)
    const merchantLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'applicant.merchant@example.com', password: 'password123' });
    const merchantToken = merchantLogin.body.token;

    const dashRes = await request(app)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body).toHaveProperty('metrics');
  });

  test('8. Admin rejection requires reason and denies dashboard access', async () => {
    // 1. Register second merchant
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'rejected.merchant@example.com',
        password: 'password123',
        name: 'Unqualified Applicant',
        role: 'merchant',
        business_name: 'Suspicious Store',
        reason: 'Just testing.',
      });
    const appId = reg.body.application_id;

    // 2. Admin login
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: env.ADMIN_EMAIL, password: 'password123' });
    const adminToken = adminLogin.body.token;

    // 3. Attempt rejection without reason (HTTP 400)
    const failReject = await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(failReject.status).toBe(400);

    // 4. Reject with valid reason
    const rejectRes = await request(app)
      .post(`/api/admin/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejection_reason: 'Incomplete business verification documents.' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('rejected');
    expect(rejectRes.body.rejection_reason).toBe('Incomplete business verification documents.');

    // 5. Verify rejected merchant is blocked from dashboard (HTTP 403)
    const rejLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rejected.merchant@example.com', password: 'password123' });

    const dashRes = await request(app)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${rejLogin.body.token}`);

    expect(dashRes.status).toBe(403);
    expect(dashRes.body.error).toContain('rejected');
  });

  test('9. Seeded merchant nnnnsachdeva@gmail.com logs in with approved dashboard access', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nnnnsachdeva@gmail.com', password: 'password123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.email).toBe('nnnnsachdeva@gmail.com');
    expect(loginRes.body.role).toBe('merchant');

    const dashRes = await request(app)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body).toHaveProperty('metrics');
  });

  test('10. Duplicate registration returns HTTP 409 Conflict', async () => {
    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'applicant.merchant@example.com',
        password: 'password123',
        name: 'Duplicate Applicant',
        role: 'merchant',
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error).toContain('already registered');
  });

  test('11. Customer role cannot access merchant dashboard or admin endpoints (HTTP 403)', async () => {
    const custReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'standard.customer@example.com',
        password: 'password123',
        name: 'Standard Customer',
        role: 'customer',
      });

    expect(custReg.status).toBe(201);
    const custToken = custReg.body.token;

    const merchDash = await request(app)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${custToken}`);
    expect(merchDash.status).toBe(403);

    const adminSummary = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${custToken}`);
    expect(adminSummary.status).toBe(403);
  });
});
