import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/config/db.js';
import { runMigrations } from '../src/config/migrate.js';

describe('Auth & Staff Service Integration Tests', () => {
  const testBadgeId = `AS-POL-${Date.now()}`;
  const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
  const testPassword = 'SecureAssamPass123!';
  let officerId = '';
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    // Cleanup created test records
    if (officerId) {
      await query(`DELETE FROM officers WHERE id = $1`, [officerId]);
    }
  });

  it('1. POST /health - should return status UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toContain('CrashScribe Auth');
  });

  it('2. POST /api/v1/auth/signup - should register a new officer', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        official_id: testBadgeId,
        name: 'Inspector B. Kalita',
        email: `kalita_${Date.now()}@assam.police.gov.in`,
        phone: testPhone,
        password: testPassword,
        district: 'Kamrup Metropolitan',
        police_station: 'Dispur Traffic Branch',
        designation: 'Sub-Inspector',
        role: 'OFFICER',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.officer).toBeDefined();
    expect(res.body.data.officer.official_id).toBe(testBadgeId);
    expect(res.body.data.officer.password_hash).toBeUndefined(); // Never expose hash!
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    officerId = res.body.data.officer.id;
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('3. POST /api/v1/auth/signup - should reject duplicate official ID', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        official_id: testBadgeId, // duplicate badge!
        name: 'Another Officer',
        phone: '9999988888',
        password: 'Password123!',
        district: 'Kamrup',
        police_station: 'Panbazar',
        designation: 'Constable',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('DUPLICATE_BADGE_ID');
  });

  it('4. POST /api/v1/auth/login - should authenticate officer with badge ID', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        login_id: testBadgeId,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.officer.official_id).toBe(testBadgeId);
  });

  it('5. POST /api/v1/auth/login - should authenticate officer with phone number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        login_id: testPhone,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('6. POST /api/v1/auth/login - should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        login_id: testBadgeId,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('INVALID_CREDENTIALS');
  });

  it('7. POST /api/v1/auth/refresh - should rotate refresh token and return new tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: refreshToken,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(refreshToken); // Token rotated!

    // Using old refresh token again should now fail
    const reusedRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: refreshToken,
      });
    expect(reusedRes.status).toBe(401);
  });

  it('8. GET /api/v1/auth/profile - should retrieve officer profile using X-Officer-ID header', async () => {
    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('X-Officer-ID', officerId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(officerId);
    expect(res.body.data.name).toBe('Inspector B. Kalita');
    expect(res.body.data.district).toBe('Kamrup Metropolitan');
  });

  it('9. PUT /api/v1/auth/profile - should update profile details', async () => {
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('X-Officer-ID', officerId)
      .send({
        designation: 'Senior Inspector',
        police_station: 'Jalukbari Traffic Branch',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.designation).toBe('Senior Inspector');
    expect(res.body.data.police_station).toBe('Jalukbari Traffic Branch');
  });
});
