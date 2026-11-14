"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_js_1 = require("./config/index.js");
const report_routes_js_1 = require("./routes/report.routes.js");
const migrate_js_1 = require("./config/migrate.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json({ limit: '10mb' })); // Allow up to 10mb for batch payloads
// Health Check
exports.app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'CrashScribe Report Ingestion & Sync Service',
        port: index_js_1.config.port,
        redis: index_js_1.config.useRedis ? 'ENABLED' : 'IN_MEMORY_FALLBACK',
        timestamp: new Date().toISOString(),
    });
});
// Mount Routes (handles both gateway /api/v1/reports and direct /reports)
exports.app.use('/api/v1/reports', report_routes_js_1.reportRouter);
exports.app.use('/reports', report_routes_js_1.reportRouter);
async function startServer() {
    try {
        await (0, migrate_js_1.runMigrations)();
        const server = exports.app.listen(index_js_1.config.port, () => {
            console.log(`[Report Service Listening] http://localhost:${index_js_1.config.port}`);
            console.log(`[Health Endpoint] http://localhost:${index_js_1.config.port}/health`);
        });
        return server;
    }
    catch (err) {
        console.error('[Report Service Fatal] Failed to start:', err);
        process.exit(1);
    }
}
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
