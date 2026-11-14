"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const db_js_1 = require("../config/db.js");
const redis_js_1 = require("../config/redis.js");
class ReportService {
    /**
     * Synchronizes an accident report atomically with distributed idempotency protection.
     */
    static async syncReport(report, officerId) {
        const lockAcquired = await redis_js_1.DistributedLock.acquire(report.client_report_id, 10);
        if (!lockAcquired) {
            // If lock is held by another concurrent request, yield and query DB
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
        const client = await db_js_1.pool.connect();
        try {
            // 1. Idempotency Check: Does client_report_id already exist?
            const existing = await client.query(`SELECT id, client_report_id, status, synced_at FROM accident_reports WHERE client_report_id = $1 LIMIT 1`, [report.client_report_id]);
            if (existing.rows.length > 0) {
                const row = existing.rows[0];
                return {
                    client_report_id: row.client_report_id,
                    server_report_id: row.id,
                    status: row.status,
                    synced_at: row.synced_at.toISOString(),
                    is_duplicate: true,
                };
            }
            // 2. Begin Atomic Transaction
            await client.query('BEGIN');
            // 3. Insert Master Accident Report
            const insertReportQuery = `
        INSERT INTO accident_reports (
          client_report_id, officer_id, accident_date, accident_time,
          accident_category, accident_nature, severity, state, district,
          police_station, road_name, landmark, exact_location, latitude,
          longitude, road_type, surface_condition, weather_condition,
          visibility, lighting_condition, accident_description, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, 'SYNCED'
        )
        RETURNING id, client_report_id, status, synced_at
      `;
            const reportValues = [
                report.client_report_id,
                officerId,
                report.accident_date,
                report.accident_time,
                report.accident_category,
                report.accident_nature,
                report.severity,
                report.state || 'Assam',
                report.district,
                report.police_station,
                report.road_name || null,
                report.landmark || null,
                report.exact_location,
                report.latitude || null,
                report.longitude || null,
                report.road_type || null,
                report.surface_condition || null,
                report.weather_condition || null,
                report.visibility || null,
                report.lighting_condition || null,
                report.accident_description,
            ];
            const reportResult = await client.query(insertReportQuery, reportValues);
            const serverReport = reportResult.rows[0];
            const serverReportId = serverReport.id;
            // 4. Insert Vehicles (1-to-N) & Build client_vehicle_id -> server_vehicle_id map
            const vehicleIdMap = new Map();
            for (const v of report.vehicles) {
                const vResult = await client.query(`INSERT INTO vehicles (
            report_id, client_vehicle_id, vehicle_category, registration_number,
            vehicle_make_model, movement_direction, damage_description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, client_vehicle_id`, [
                    serverReportId,
                    v.client_vehicle_id,
                    v.vehicle_category,
                    v.registration_number || null,
                    v.vehicle_make_model || null,
                    v.movement_direction || null,
                    v.damage_description || null,
                ]);
                vehicleIdMap.set(v.client_vehicle_id, vResult.rows[0].id);
            }
            // 5. Insert Persons (1-to-N)
            for (const p of report.persons) {
                const linkedServerVehicleId = p.client_vehicle_id ? vehicleIdMap.get(p.client_vehicle_id) || null : null;
                await client.query(`INSERT INTO persons (
            report_id, vehicle_id, client_person_id, person_role, name,
            age, gender, injury_status, hospital_name, helmet_seatbelt_used
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
                    serverReportId,
                    linkedServerVehicleId,
                    p.client_person_id,
                    p.person_role,
                    p.name || null,
                    p.age ?? null,
                    p.gender || null,
                    p.injury_status,
                    p.hospital_name || null,
                    p.helmet_seatbelt_used ?? false,
                ]);
            }
            // 6. Insert Transactional Outbox Event for Event Broker / Analytics
            const outboxPayload = {
                report_id: serverReportId,
                client_report_id: report.client_report_id,
                officer_id: officerId,
                accident_date: report.accident_date,
                accident_time: report.accident_time,
                severity: report.severity,
                district: report.district,
                police_station: report.police_station,
                latitude: report.latitude,
                longitude: report.longitude,
                vehicles_count: report.vehicles.length,
                fatalities_count: report.persons.filter((p) => p.injury_status.toLowerCase().includes('fatal')).length,
                injuries_count: report.persons.filter((p) => p.injury_status.toLowerCase().includes('injury') || p.injury_status.toLowerCase().includes('grievous')).length,
            };
            await client.query(`INSERT INTO report_outbox (
          aggregate_type, aggregate_id, event_type, payload
        ) VALUES ($1, $2, $3, $4)`, ['ACCIDENT_REPORT', serverReportId, 'ACCIDENT_REPORT_CREATED', JSON.stringify(outboxPayload)]);
            // 7. Commit Transaction
            await client.query('COMMIT');
            return {
                client_report_id: serverReport.client_report_id,
                server_report_id: serverReport.id,
                status: serverReport.status,
                synced_at: serverReport.synced_at.toISOString(),
            };
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('[Sync Transaction Rollback]', err);
            throw err;
        }
        finally {
            client.release();
            await redis_js_1.DistributedLock.release(report.client_report_id);
        }
    }
    /**
     * Retrieves single full accident report with nested vehicles and casualties
     */
    static async getReportById(reportId) {
        const client = await db_js_1.pool.connect();
        try {
            const reportRes = await client.query(`SELECT * FROM accident_reports WHERE id = $1 LIMIT 1`, [reportId]);
            if (reportRes.rows.length === 0) {
                return null;
            }
            const report = reportRes.rows[0];
            const vehiclesRes = await client.query(`SELECT * FROM vehicles WHERE report_id = $1`, [reportId]);
            const personsRes = await client.query(`SELECT * FROM persons WHERE report_id = $1`, [reportId]);
            return {
                ...report,
                vehicles: vehiclesRes.rows,
                persons: personsRes.rows,
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Lists accident reports filtered by district or officer
     */
    static async listReports(filters) {
        const client = await db_js_1.pool.connect();
        try {
            const conditions = [];
            const values = [];
            let idx = 1;
            if (filters.district) {
                conditions.push(`district = $${idx++}`);
                values.push(filters.district);
            }
            if (filters.officerId) {
                conditions.push(`officer_id = $${idx++}`);
                values.push(filters.officerId);
            }
            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const limit = filters.limit || 50;
            const offset = filters.offset || 0;
            values.push(limit, offset);
            const queryStr = `
        SELECT id, client_report_id, officer_id, accident_date, accident_time, severity,
               district, police_station, exact_location, status, version, synced_at
        FROM accident_reports
        ${whereClause}
        ORDER BY accident_date DESC, accident_time DESC
        LIMIT $${idx++} OFFSET $${idx}
      `;
            const result = await client.query(queryStr, values);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
}
exports.ReportService = ReportService;
