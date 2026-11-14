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
const evidence_routes_js_1 = require("./routes/evidence.routes.js");
const migrate_js_1 = require("./config/migrate.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
// Health Check
exports.app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'CrashScribe Evidence Media Service',
        port: index_js_1.config.port,
        storage_provider: index_js_1.config.r2.accountId ? 'cloudflare_r2' : 'local_fallback',
        bucket: index_js_1.config.r2.bucketName,
        timestamp: new Date().toISOString(),
    });
});
// Mount Routes (handles both /api/v1/evidence and direct /evidence)
exports.app.use('/api/v1/evidence', evidence_routes_js_1.evidenceRouter);
exports.app.use('/evidence', evidence_routes_js_1.evidenceRouter);
async function startServer() {
    try {
        await (0, migrate_js_1.runMigrations)();
        const server = exports.app.listen(index_js_1.config.port, () => {
            console.log(`[Evidence Service Listening] http://localhost:${index_js_1.config.port}`);
            console.log(`[Health Endpoint] http://localhost:${index_js_1.config.port}/health`);
        });
        return server;
    }
    catch (err) {
        console.error('[Evidence Service Fatal] Failed to start:', err);
        process.exit(1);
    }
}
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
