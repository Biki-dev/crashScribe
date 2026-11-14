import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { query } from '../src/config/db.js';
import { runMigrations } from '../src/config/migrate.js';

describe('Report Ingestion & Sync Service Integration Tests', () => {
  const testOfficerId = '11111111-2222-3333-4444-555555555555';
  const clientReportId = 'a0000000-bbbb-cccc-dddd-eeeeeeeeeeee';
  const clientVehicleId1 = 'b1111111-0000-0000-0000-000000000001';
  const clientVehicleId2 = 'b2222222-0000-0000-0000-000000000002';
  const clientPersonId1 = 'c1111111-0000-0000-0000-000000000001';
  const clientPersonId2 = 'c2222222-0000-0000-0000-000000000002';

  let serverReportId = '';

  beforeAll(async () => {
    await runMigrations();
    // Clean up test data if any
    await query(`DELETE FROM accident_reports WHERE client_report_id = $1`, [clientReportId]);
  });

  it('1. GET /health - should return status UP with Redis/Fallback state', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toContain('Report Ingestion');
    expect(res.body.redis).toBeDefined();
  });

  it('2. POST /api/v1/reports/sync - should ingest complete multi-vehicle & multi-casualty eDAR report', async () => {
    const payload = {
      client_report_id: clientReportId,
      accident_date: '2026-11-14',
      accident_time: '14:45:00',
      accident_category: 'Head-on Collision',
      accident_nature: 'Fatal',
      severity: 'Fatal',
      state: 'Assam',
      district: 'Kamrup Metropolitan',
      police_station: 'Dispur Traffic Branch',
      road_name: 'National Highway 37',
      landmark: 'Near Khanapara Flyover',
      exact_location: 'NH-37 Westbound, Ch 142.5 km',
      latitude: 26.1285,
      longitude: 91.8123,
      road_type: 'Four Lane Divided',
      surface_condition: 'Wet Asphalt',
      weather_condition: 'Heavy Rain',
      visibility: 'Poor',
      lighting_condition: 'Daylight',
      accident_description: 'Commercial 10-wheeler truck lost traction and collided head-on with a private hatchback.',
      vehicles: [
        {
          client_vehicle_id: clientVehicleId1,
          vehicle_category: 'Commercial Truck / HGV',
          registration_number: 'AS-01-EC-9988',
          vehicle_make_model: 'Tata Prima 2828',
          movement_direction: 'Westbound',
          damage_description: 'Severe front bumper and axle damage',
        },
        {
          client_vehicle_id: clientVehicleId2,
          vehicle_category: 'Car / Hatchback',
          registration_number: 'AS-01-BJ-1234',
          vehicle_make_model: 'Maruti Suzuki Swift',
          movement_direction: 'Eastbound',
          damage_description: 'Front engine compartment completely crushed',
        },
      ],
      persons: [
        {
          client_person_id: clientPersonId1,
          client_vehicle_id: clientVehicleId2,
          person_role: 'Driver',
          name: 'N. Barman',
          age: 38,
          gender: 'Male',
          injury_status: 'Fatal',
          hospital_name: 'Gauhati Medical College & Hospital (GMCH)',
          helmet_seatbelt_used: true,
        },
        {
          client_person_id: clientPersonId2,
          client_vehicle_id: clientVehicleId1,
          person_role: 'Driver',
          name: 'S. Ali',
          age: 45,
          gender: 'Male',
          injury_status: 'Minor Injury',
          hospital_name: 'Dispur Polyclinic',
          helmet_seatbelt_used: true,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/reports/sync')
      .set('X-Officer-ID', testOfficerId)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.synced).toHaveLength(1);

    const synced = res.body.synced[0];
    expect(synced.client_report_id).toBe(clientReportId);
    expect(synced.server_report_id).toBeDefined();
    expect(synced.status).toBe('SYNCED');

    serverReportId = synced.server_report_id;
  });

  it('3. POST /api/v1/reports/sync - Idempotency Replay Test (duplicate submission returns 200 without creating duplicate rows)', async () => {
    // Send 5 concurrent duplicate sync requests
    const duplicatePayload = {
      client_report_id: clientReportId, // Same ID!
      accident_date: '2026-11-14',
      accident_time: '14:45:00',
      accident_category: 'Head-on Collision',
      accident_nature: 'Fatal',
      severity: 'Fatal',
      district: 'Kamrup Metropolitan',
      police_station: 'Dispur Traffic Branch',
      exact_location: 'NH-37 Westbound, Ch 142.5 km',
      accident_description: 'Commercial 10-wheeler truck lost traction and collided head-on with a private hatchback.',
      vehicles: [
        {
          client_vehicle_id: clientVehicleId1,
          vehicle_category: 'Commercial Truck / HGV',
        },
      ],
      persons: [
        {
          client_person_id: clientPersonId1,
          person_role: 'Driver',
          injury_status: 'Fatal',
        },
      ],
    };

    const results = await Promise.all([
      request(app).post('/api/v1/reports/sync').set('X-Officer-ID', testOfficerId).send(duplicatePayload),
      request(app).post('/api/v1/reports/sync').set('X-Officer-ID', testOfficerId).send(duplicatePayload),
      request(app).post('/api/v1/reports/sync').set('X-Officer-ID', testOfficerId).send(duplicatePayload),
    ]);

    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.synced[0].server_report_id).toBe(serverReportId);
    }

    // Verify database count for this client_report_id is strictly 1
    const countRes = await query(`SELECT COUNT(*) FROM accident_reports WHERE client_report_id = $1`, [clientReportId]);
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);

    // Verify vehicles count is strictly 2 from the initial ingestion
    const vehicleCount = await query(`SELECT COUNT(*) FROM vehicles WHERE report_id = $1`, [serverReportId]);
    expect(parseInt(vehicleCount.rows[0].count, 10)).toBe(2);
  });

  it('4. Outbox CDC Verification - Transactional Outbox record exists for event broker', async () => {
    const outboxRes = await query(`SELECT * FROM report_outbox WHERE aggregate_id = $1`, [serverReportId]);
    expect(outboxRes.rows).toHaveLength(1);

    const event = outboxRes.rows[0];
    expect(event.event_type).toBe('ACCIDENT_REPORT_CREATED');
    expect(event.processed).toBe(false);

    const payload = event.payload;
    expect(payload.report_id).toBe(serverReportId);
    expect(payload.vehicles_count).toBe(2);
    expect(payload.fatalities_count).toBe(1);
    expect(payload.injuries_count).toBe(1);
  });

  it('5. GET /api/v1/reports/:id - retrieves complete report with nested vehicles and persons', async () => {
    const res = await request(app).get(`/api/v1/reports/${serverReportId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data;
    expect(report.id).toBe(serverReportId);
    expect(report.district).toBe('Kamrup Metropolitan');
    expect(report.vehicles).toHaveLength(2);
    expect(report.persons).toHaveLength(2);
  });

  it('6. GET /api/v1/reports - lists reports filtered by district', async () => {
    const res = await request(app).get('/api/v1/reports?district=Kamrup%20Metropolitan');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it('7. POST /api/v1/reports/sync - rejects payload with missing mandatory fields', async () => {
    const invalidPayload = {
      client_report_id: '99999999-9999-9999-9999-999999999999',
      // Missing accident_date, district, police_station, vehicles, etc.
      accident_description: 'Incomplete',
    };

    const res = await request(app).post('/api/v1/reports/sync').send(invalidPayload);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveLength(1);
  });
});
