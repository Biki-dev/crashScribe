import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Applying schema migrations for crashscribe_auth...');
    const migrationPath = path.resolve(__dirname, '../../migrations/001_create_auth_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await client.query(sql);
    console.log('[Migration] Migration applied successfully.');
  } catch (error) {
    console.error('[Migration Error] Failed to run migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Auto-run when executed directly via npm run migrate
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}
