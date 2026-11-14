"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_js_1 = require("./config/index.js");
const analytics_routes_js_1 = require("./routes/analytics.routes.js");
const ingestion_service_js_1 = require("./services/ingestion.service.js");
const db_js_1 = require("./config/db.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
// Health Check
exports.app.get('/health', async (_req, res) => {
    try {
        const dbRes = await db_js_1.pool.query('SELECT 1');
        res.json({
            status: 'UP',
            service: 'analytics-service',
            database: dbRes.rows.length === 1 ? 'CONNECTED' : 'DISCONNECTED',
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        res.status(503).json({
            status: 'DOWN',
            service: 'analytics-service',
            error: err.message,
        });
    }
});
// Analytics endpoints
exports.app.use('/api/v1/analytics', analytics_routes_js_1.analyticsRouter);
// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
    exports.app.listen(index_js_1.config.port, async () => {
        console.log(`[Analytics Service] Server running on port ${index_js_1.config.port}`);
        try {
            await ingestion_service_js_1.AnalyticsIngestionService.startConsumer();
            console.log('[Analytics Service] CDC Consumer attached successfully.');
        }
        catch (cErr) {
            console.error('[Analytics Service] Failed to initialize CDC Consumer:', cErr);
        }
    });
}
