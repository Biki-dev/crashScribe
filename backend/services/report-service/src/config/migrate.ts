import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Applying schema migrations for crashscribe_reports...');
    const migrationPath = path.resolve(process.cwd(), 'migrations/001_create_reports_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await client.query(sql);
    console.log('[Migration] Reports migrations applied successfully.');
  } catch (error) {
    console.error('[Migration Error] Failed to run reports migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}
