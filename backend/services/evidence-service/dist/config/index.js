"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../.env') });
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.EVIDENCE_PORT || '5003', 10),
    databaseUrl: process.env.EVIDENCE_DB_URL || 'postgres://localhost:5432/crashscribe_evidence?sslmode=disable',
    storageProvider: process.env.STORAGE_PROVIDER || 'r2', // 'r2' | 'local'
    localStoragePath: process.env.LOCAL_STORAGE_PATH || './backend/storage/uploads',
    r2: {
        accountId: process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
        bucketName: process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'crashscribe-assets',
        publicUrl: process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
    },
};
