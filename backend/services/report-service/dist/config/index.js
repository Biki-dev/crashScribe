"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../.env') });
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.REPORT_PORT || '5002', 10),
    databaseUrl: process.env.REPORTS_DB_URL || 'postgres://localhost:5432/crashscribe_reports?sslmode=disable',
    useRedis: process.env.USE_REDIS === 'true',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
