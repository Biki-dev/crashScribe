"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const report_service_js_1 = require("../services/report.service.js");
const validate_js_1 = require("../middleware/validate.js");
class ReportController {
    /**
     * POST /sync - Ingests single or batch reports from mobile offline client
     */
    static async syncReports(req, res) {
        try {
            // Officer ID injected by Go API Gateway (or fallback for direct testing)
            const officerId = req.headers['x-officer-id'] || req.body.officer_id || '00000000-0000-0000-0000-000000000000';
            const body = req.body;
            const reportsToSync = Array.isArray(body.reports) ? body.reports : [body];
            // Validate batch or single payload
            const syncedResults = [];
            const errors = [];
            for (const item of reportsToSync) {
                const parsed = validate_js_1.SingleReportSchema.safeParse(item);
                if (!parsed.success) {
                    errors.push({
                        client_report_id: item?.client_report_id || 'unknown',
                        error: 'Validation failed',
                        details: parsed.error.errors,
                    });
                    continue;
                }
                try {
                    const result = await report_service_js_1.ReportService.syncReport(parsed.data, officerId);
                    syncedResults.push(result);
                }
                catch (err) {
                    console.error('[Sync Error]', err);
                    errors.push({
                        client_report_id: item.client_report_id,
                        error: err.message || 'Failed to sync report into database',
                    });
                }
            }
            const statusCode = syncedResults.length > 0 ? 200 : 400;
            return res.status(statusCode).json({
                success: errors.length === 0,
                synced: syncedResults,
                errors,
            });
        }
        catch (err) {
            console.error('[Sync Controller Fatal]', err);
            return res.status(500).json({ success: false, error: 'Internal server error during sync' });
        }
    }
    /**
     * GET /:id - Retrieve single accident report details
     */
    static async getReport(req, res) {
        try {
            const { id } = req.params;
            const report = await report_service_js_1.ReportService.getReportById(id);
            if (!report) {
                return res.status(404).json({ success: false, error: 'Accident report not found' });
            }
            return res.status(200).json({ success: true, data: report });
        }
        catch (err) {
            console.error('[Get Report Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error retrieving report' });
        }
    }
    /**
     * GET / - List reports
     */
    static async listReports(req, res) {
        try {
            const district = req.query.district;
            const officerId = req.query.officer_id;
            const limit = parseInt(req.query.limit, 10) || 50;
            const offset = parseInt(req.query.offset, 10) || 0;
            const reports = await report_service_js_1.ReportService.listReports({ district, officerId, limit, offset });
            return res.status(200).json({ success: true, count: reports.length, data: reports });
        }
        catch (err) {
            console.error('[List Reports Error]', err);
            return res.status(500).json({ success: false, error: 'Internal server error listing reports' });
        }
    }
}
exports.ReportController = ReportController;
