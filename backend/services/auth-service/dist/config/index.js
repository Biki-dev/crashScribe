"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from workspace root or parent dirs
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../.env') });
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.AUTH_PORT || '5001', 10),
    databaseUrl: process.env.AUTH_DB_URL || 'postgres://localhost:5432/crashscribe_auth?sslmode=disable',
    jwtSecret: process.env.JWT_SECRET || 'crashscribe_super_secret_jwt_dev_key_2026_assam_police_traffic',
    jwtExpiration: process.env.JWT_EXPIRATION || '15m',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'crashscribe_super_secret_refresh_dev_key_2026',
    jwtRefreshExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '30d',
};
