"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateAnalytics = migrateAnalytics;
const db_js_1 = require("./db.js");
async function migrateAnalytics() {
    console.log('[Analytics DB] Running schema migrations...');
    const client = await db_js_1.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. Enable uuid-ossp extension
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        // 2. Spatial / Analytical Accident Records read-model table
        // PostGIS or fallback lat/lng with bounding box indexes
        await client.query(`
      CREATE TABLE IF NOT EXISTS spatial_accident_records (
        id UUID PRIMARY KEY,
        report_number VARCHAR(100) UNIQUE,
        district VARCHAR(100) NOT NULL,
        police_station VARCHAR(100) NOT NULL,
        collision_type VARCHAR(50),
        severity VARCHAR(50) NOT NULL,
        fatalities INTEGER DEFAULT 0,
        injuries INTEGER DEFAULT 0,
        vehicles_count INTEGER DEFAULT 0,
        weather VARCHAR(50),
        road_type VARCHAR(50),
        latitude NUMERIC(10, 7) NOT NULL,
        longitude NUMERIC(10, 7) NOT NULL,
        accident_timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        // Create high-performance spatial & filter indexes
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_spatial_accidents_district ON spatial_accident_records(district);
      CREATE INDEX IF NOT EXISTS idx_spatial_accidents_ps ON spatial_accident_records(police_station);
      CREATE INDEX IF NOT EXISTS idx_spatial_accidents_timestamp ON spatial_accident_records(accident_timestamp);
      CREATE INDEX IF NOT EXISTS idx_spatial_accidents_severity ON spatial_accident_records(severity);
      CREATE INDEX IF NOT EXISTS idx_spatial_accidents_coords ON spatial_accident_records(latitude, longitude);
    `);
        // 3. Optional PostGIS geometry column check (if PostGIS is installed on system)
        const postgisCheck = await client.query(`
      SELECT 1 FROM pg_extension WHERE extname = 'postgis';
    `);
        if (postgisCheck.rows.length > 0) {
            await client.query(`
        ALTER TABLE spatial_accident_records 
        ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

        CREATE INDEX IF NOT EXISTS idx_spatial_accidents_geom 
        ON spatial_accident_records USING GIST(geom);
      `);
            console.log('[Analytics DB] PostGIS native geometry column and GIST index enabled.');
        }
        await client.query('COMMIT');
        console.log('[Analytics DB] Schema migration completed successfully.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('[Analytics DB] Schema migration failed:', err);
        throw err;
    }
    finally {
        client.release();
    }
}
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
    migrateAnalytics()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
