import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.REPORT_PORT || '5002', 10),
  databaseUrl: process.env.REPORTS_DB_URL || 'postgres://localhost:5432/crashscribe_reports?sslmode=disable',
  useRedis: process.env.USE_REDIS === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
