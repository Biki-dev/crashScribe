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
const auth_routes_js_1 = require("./routes/auth.routes.js");
const migrate_js_1 = require("./config/migrate.js");
exports.app = (0, express_1.default)();
// Middlewares
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
// Health Check
exports.app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'CrashScribe Auth & Staff Service',
        port: index_js_1.config.port,
        timestamp: new Date().toISOString(),
    });
});
// Mount Routes (handles both /api/v1/auth and direct /auth)
exports.app.use('/api/v1/auth', auth_routes_js_1.authRouter);
exports.app.use('/auth', auth_routes_js_1.authRouter);
async function startServer() {
    try {
        // Run DB schema migrations on startup
        await (0, migrate_js_1.runMigrations)();
        const server = exports.app.listen(index_js_1.config.port, () => {
            console.log(`[Auth Service Listening] http://localhost:${index_js_1.config.port}`);
            console.log(`[Health Endpoint] http://localhost:${index_js_1.config.port}/health`);
        });
        return server;
    }
    catch (err) {
        console.error('[Auth Service Fatal] Failed to start:', err);
        process.exit(1);
    }
}
// Auto-run if executed directly
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
