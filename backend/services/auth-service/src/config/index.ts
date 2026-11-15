import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or parent dirs
dotenv.config({ path: path.resolve(process.cwd(), '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.AUTH_PORT || '5001', 10),
  databaseUrl: process.env.AUTH_DB_URL || 'postgres://localhost:5432/crashscribe_auth?sslmode=disable',
  jwtSecret: process.env.JWT_SECRET || 'crashscribe_super_secret_jwt_dev_key_2026_assam_police_traffic',
  jwtExpiration: process.env.JWT_EXPIRATION || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'crashscribe_super_secret_refresh_dev_key_2026',
  jwtRefreshExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '30d',
};
