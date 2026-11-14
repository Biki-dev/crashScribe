import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const config = {
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
