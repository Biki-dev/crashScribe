import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/config/db.js';
import { runMigrations } from '../src/config/migrate.js';

describe('Evidence Media Service Integration Tests', () => {
  const testOfficerId = '11111111-2222-3333-4444-555555555555';
  const testReportId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
  const clientEvidenceId = 'e1111111-2222-3333-4444-555555555555';
  const sampleSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  beforeAll(async () => {
    await runMigrations();
    await query(`DELETE FROM report_evidence WHERE client_evidence_id = $1`, [clientEvidenceId]);
  });

  it('1. GET /health - should return status UP and storage provider', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toContain('Evidence Media');
    expect(res.body.storage_provider).toBeDefined();
  });

  let uploadUrl = '';

  it('2. POST /api/v1/evidence/presigned-url - should generate presigned upload URL and register pending record', async () => {
    const payload = {
      report_id: testReportId,
      client_evidence_id: clientEvidenceId,
      file_name: 'crash_scene_front_angle.jpg',
      file_type: 'image/jpeg',
      file_size_bytes: 3500000, // 3.5 MB
      sha256_hash: sampleSha256,
      caption: 'Front collision view showing damage to Swift and truck axle',
      gps_lat: 26.1285,
      gps_long: 91.8123,
    };

    const res = await request(app)
      .post('/api/v1/evidence/presigned-url')
      .set('X-Officer-ID', testOfficerId)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.client_evidence_id).toBe(clientEvidenceId);
    expect(res.body.data.upload_url).toBeDefined();
    expect(res.body.data.storage_key).toContain(testReportId);
    expect(res.body.data.storage_key).toContain(clientEvidenceId);

    uploadUrl = res.body.data.upload_url;

    // Verify DB record is registered as PENDING
    const dbRes = await query(`SELECT * FROM report_evidence WHERE client_evidence_id = $1`, [clientEvidenceId]);
    expect(dbRes.rows).toHaveLength(1);
    expect(dbRes.rows[0].upload_status).toBe('PENDING');
    expect(dbRes.rows[0].file_name).toBe('crash_scene_front_angle.jpg');
  });

  it('3. POST /api/v1/evidence/presigned-url - Idempotency Replay returns existing storage key', async () => {
    const payload = {
      report_id: testReportId,
      client_evidence_id: clientEvidenceId, // Same client ID
      file_name: 'crash_scene_front_angle.jpg',
      file_type: 'image/jpeg',
      file_size_bytes: 3500000,
      sha256_hash: sampleSha256,
    };

    const res = await request(app)
      .post('/api/v1/evidence/presigned-url')
      .set('X-Officer-ID', testOfficerId)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.client_evidence_id).toBe(clientEvidenceId);

    // Verify no duplicate row was created in database
    const countRes = await query(`SELECT COUNT(*) FROM report_evidence WHERE client_evidence_id = $1`, [clientEvidenceId]);
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
  });

  it('4. POST /api/v1/evidence/presigned-url - should reject invalid file types (e.g. PDF/EXE)', async () => {
    const invalidPayload = {
      report_id: testReportId,
      client_evidence_id: 'e2222222-3333-4444-5555-666666666666',
      file_name: 'document.pdf',
      file_type: 'application/pdf',
      file_size_bytes: 1000,
      sha256_hash: sampleSha256,
    };

    const res = await request(app)
      .post('/api/v1/evidence/presigned-url')
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('5. POST /api/v1/evidence/confirm - confirms upload and marks COMPLETED', async () => {
    // Perform simulated binary upload to Cloudflare R2 presigned URL
    if (uploadUrl) {
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: Buffer.from('mock_image_binary_data'),
      });
    }

    const res = await request(app)
      .post('/api/v1/evidence/confirm')
      .send({ client_evidence_id: clientEvidenceId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.upload_status).toBe('COMPLETED');
    expect(res.body.data.uploaded_at).toBeDefined();

    // Verify database reflects COMPLETED
    const dbRes = await query(`SELECT upload_status FROM report_evidence WHERE client_evidence_id = $1`, [clientEvidenceId]);
    expect(dbRes.rows[0].upload_status).toBe('COMPLETED');
  });

  it('6. GET /api/v1/evidence/report/:reportId - lists verified evidence for an accident report', async () => {
    const res = await request(app).get(`/api/v1/evidence/report/${testReportId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].client_evidence_id).toBe(clientEvidenceId);
    expect(res.body.data[0].upload_status).toBe('COMPLETED');
  });
});
