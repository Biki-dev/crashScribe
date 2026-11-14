"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = require("./db.js");
async function runMigrations() {
    const client = await db_js_1.pool.connect();
    try {
        console.log('[Migration] Applying schema migrations for crashscribe_reports...');
        const migrationPath = path_1.default.resolve(process.cwd(), 'migrations/001_create_reports_tables.sql');
        const sql = fs_1.default.readFileSync(migrationPath, 'utf-8');
        await client.query(sql);
        console.log('[Migration] Reports migrations applied successfully.');
    }
    catch (error) {
        console.error('[Migration Error] Failed to run reports migrations:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
    runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}
