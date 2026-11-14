import { pool } from '../config/db.js';
import { EventBroker, EventMessage } from '../config/broker.js';

export class AnalyticsIngestionService {
  /**
   * Initializes the event subscriber to consume report events and update spatial read-model
   */
  static async startConsumer(): Promise<() => void> {
    await EventBroker.initialize();

    return EventBroker.subscribe('accident.report.*', async (event: EventMessage) => {
      try {
        await this.processReportEvent(event);
      } catch (err) {
        console.error('[Analytics Consumer Error] Failed to process event:', err);
      }
    });
  }

  /**
   * Upserts accident data into spatial_accident_records with strict PII sanitization
   */
  static async processReportEvent(event: EventMessage): Promise<void> {
    const p = event.payload;
    if (!p || !p.id || p.latitude === undefined || p.longitude === undefined) {
      console.warn('[Analytics Consumer] Skipping invalid or incomplete accident payload:', event.id);
      return;
    }

    const lat = parseFloat(p.latitude);
    const lng = parseFloat(p.longitude);
    const fatalities = parseInt(p.fatalities || '0', 10);
    const injuries = parseInt(p.injuries || '0', 10);
    const vehiclesCount = Array.isArray(p.vehicles) ? p.vehicles.length : parseInt(p.vehicles_count || '0', 10);

    const upsertQuery = `
      INSERT INTO spatial_accident_records (
        id,
        report_number,
        district,
        police_station,
        collision_type,
        severity,
        fatalities,
        injuries,
        vehicles_count,
        weather,
        road_type,
        latitude,
        longitude,
        accident_timestamp,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        report_number = EXCLUDED.report_number,
        district = EXCLUDED.district,
        police_station = EXCLUDED.police_station,
        collision_type = EXCLUDED.collision_type,
        severity = EXCLUDED.severity,
        fatalities = EXCLUDED.fatalities,
        injuries = EXCLUDED.injuries,
        vehicles_count = EXCLUDED.vehicles_count,
        weather = EXCLUDED.weather,
        road_type = EXCLUDED.road_type,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accident_timestamp = EXCLUDED.accident_timestamp,
        updated_at = NOW();
    `;

    await pool.query(upsertQuery, [
      p.id,
      p.report_number || `REP-${p.id.slice(0, 8).toUpperCase()}`,
      p.district,
      p.police_station,
      p.collision_type || 'UNKNOWN',
      p.severity || 'SIMPLE',
      fatalities,
      injuries,
      vehiclesCount,
      p.weather || 'CLEAR',
      p.road_type || 'TWO_LANE',
      lat,
      lng,
      p.accident_timestamp || new Date().toISOString(),
    ]);

    // Update geometry if PostGIS is enabled
    try {
      await pool.query(`
        UPDATE spatial_accident_records
        SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)
        WHERE id = $3 AND EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'spatial_accident_records' AND column_name = 'geom'
        );
      `, [lng, lat, p.id]);
    } catch {
      // Ignored if PostGIS extension is not installed
    }
  }
}
