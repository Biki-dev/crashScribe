"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceService = void 0;
const db_js_1 = require("../config/db.js");
const r2_js_1 = require("../config/r2.js");
class EvidenceService {
    /**
     * Generates a storage key, registers pending evidence record, and returns a Cloudflare R2 presigned PUT URL
     */
    static async requestPresignedUrl(data, officerId) {
        const client = await db_js_1.pool.connect();
        try {
            // 1. Idempotency Check: Was client_evidence_id already requested?
            const existing = await client.query(`SELECT id, storage_key, upload_status, storage_provider FROM report_evidence WHERE client_evidence_id = $1 LIMIT 1`, [data.client_evidence_id]);
            let storageKey;
            let provider = 'cloudflare_r2';
            if (existing.rows.length > 0) {
                storageKey = existing.rows[0].storage_key;
                provider = existing.rows[0].storage_provider;
            }
            else {
                // Partitioned storage key: evidence/{year}/{month}/{report_id}/{client_evidence_id}.ext
                const now = new Date();
                const year = now.getUTCFullYear();
                const month = String(now.getUTCMonth() + 1).padStart(2, '0');
                const ext = data.file_name.split('.').pop() || 'jpg';
                storageKey = `evidence/${year}/${month}/${data.report_id}/${data.client_evidence_id}.${ext}`;
                // Insert pending record
                await client.query(`INSERT INTO report_evidence (
            report_id, client_evidence_id, officer_id, file_name, file_type,
            file_size_bytes, storage_key, storage_provider, sha256_hash, caption,
            gps_lat, gps_long, upload_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING')`, [
                    data.report_id,
                    data.client_evidence_id,
                    officerId,
                    data.file_name,
                    data.file_type,
                    data.file_size_bytes,
                    storageKey,
                    provider,
                    data.sha256_hash,
                    data.caption || null,
                    data.gps_lat || null,
                    data.gps_long || null,
                ]);
            }
            // Generate presigned PUT URL (15 minutes)
            const presigned = await r2_js_1.StorageService.generatePresignedPutUrl(storageKey, data.file_type, 900);
            return {
                client_evidence_id: data.client_evidence_id,
                storage_key: storageKey,
                upload_url: presigned.uploadUrl,
                expires_in_seconds: 900,
                provider: presigned.provider,
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Confirms successful upload from mobile client
     */
    static async confirmUpload(clientEvidenceId) {
        const client = await db_js_1.pool.connect();
        try {
            const existing = await client.query(`SELECT id, storage_key, upload_status FROM report_evidence WHERE client_evidence_id = $1 LIMIT 1`, [clientEvidenceId]);
            if (existing.rows.length === 0) {
                throw new Error('EVIDENCE_NOT_FOUND: Evidence record not registered.');
            }
            const record = existing.rows[0];
            // Verify object exists in storage
            const exists = await r2_js_1.StorageService.verifyObject(record.storage_key);
            if (!exists) {
                throw new Error('STORAGE_VERIFICATION_FAILED: Binary file not found in storage bucket.');
            }
            // Update status to COMPLETED
            const updateResult = await client.query(`UPDATE report_evidence
         SET upload_status = 'COMPLETED', uploaded_at = NOW()
         WHERE id = $1
         RETURNING id, client_evidence_id, report_id, storage_key, upload_status, uploaded_at`, [record.id]);
            return updateResult.rows[0];
        }
        finally {
            client.release();
        }
    }
    /**
     * Lists all evidence attached to an accident report
     */
    static async listEvidenceByReport(reportId) {
        const client = await db_js_1.pool.connect();
        try {
            const result = await client.query(`SELECT id, report_id, client_evidence_id, file_name, file_type, file_size_bytes,
                storage_key, caption, gps_lat, gps_long, upload_status, created_at, uploaded_at
         FROM report_evidence
         WHERE report_id = $1 AND upload_status = 'COMPLETED'
         ORDER BY created_at ASC`, [reportId]);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
}
exports.EvidenceService = EvidenceService;
