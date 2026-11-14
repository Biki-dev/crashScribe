"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceController = void 0;
const evidence_service_js_1 = require("../services/evidence.service.js");
const validate_js_1 = require("../middleware/validate.js");
class EvidenceController {
    /**
     * POST /presigned-url - Requests Cloudflare R2 presigned PUT URL
     */
    static async requestPresignedUrl(req, res) {
        try {
            const officerId = req.headers['x-officer-id'] || req.body.officer_id || '00000000-0000-0000-0000-000000000000';
            const parsed = validate_js_1.RequestPresignedUrlSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: parsed.error.errors,
                });
            }
            const result = await evidence_service_js_1.EvidenceService.requestPresignedUrl(parsed.data, officerId);
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (err) {
            console.error('[Presigned URL Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error generating presigned URL' });
        }
    }
    /**
     * POST /confirm - Confirms client upload completion
     */
    static async confirmUpload(req, res) {
        try {
            const parsed = validate_js_1.ConfirmUploadSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: parsed.error.errors,
                });
            }
            const result = await evidence_service_js_1.EvidenceService.confirmUpload(parsed.data.client_evidence_id);
            return res.status(200).json({
                success: true,
                message: 'Evidence verified and marked COMPLETED',
                data: result,
            });
        }
        catch (err) {
            if (err.message && err.message.startsWith('EVIDENCE_NOT_FOUND')) {
                return res.status(404).json({ success: false, error: err.message });
            }
            if (err.message && err.message.startsWith('STORAGE_VERIFICATION_FAILED')) {
                return res.status(400).json({ success: false, error: err.message });
            }
            console.error('[Confirm Upload Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error confirming upload' });
        }
    }
    /**
     * GET /report/:reportId - Lists all verified evidence for an accident report
     */
    static async listByReport(req, res) {
        try {
            const { reportId } = req.params;
            const evidenceList = await evidence_service_js_1.EvidenceService.listEvidenceByReport(reportId);
            return res.status(200).json({
                success: true,
                count: evidenceList.length,
                data: evidenceList,
            });
        }
        catch (err) {
            console.error('[List Evidence Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error retrieving evidence' });
        }
    }
}
exports.EvidenceController = EvidenceController;
