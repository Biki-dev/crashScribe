import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/index.js';
import { pool } from '../src/config/db.js';
import { migrateAnalytics } from '../src/config/migrate.js';
import { AnalyticsIngestionService } from '../src/services/ingestion.service.js';
import { EventBroker } from '../src/config/broker.js';

describe('Assam Analytics & Spatial Service Integration Tests', () => {
  let unsubscribeConsumer: (() => void) | null = null;

  beforeAll(async () => {
    await migrateAnalytics();
    unsubscribeConsumer = await AnalyticsIngestionService.startConsumer();
  });

  afterAll(async () => {
    if (unsubscribeConsumer) {
      unsubscribeConsumer();
    }
    await EventBroker.close();
    await pool.end();
  });

  it('1. GET /health - should return UP with database connection', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.database).toBe('CONNECTED');
  });

  it('2. Consumer Ingestion - should process accident report events and populate spatial records', async () => {
    const accidentId1 = randomUUID();
    const accidentId2 = randomUUID();

    // Event 1: Fatal accident in Kamrup Metro
    const event1 = {
      id: randomUUID(),
      aggregate_id: accidentId1,
      event_type: 'ACCIDENT_REPORT_CREATED',
      payload: {
        id: accidentId1,
        report_number: 'REP-KM-001',
        district: 'Kamrup Metropolitan',
        police_station: 'Dispur PS',
        collision_type: 'HEAD_ON',
        severity: 'FATAL',
        fatalities: 2,
        injuries: 3,
        vehicles: [{ id: 'v1' }, { id: 'v2' }],
        weather: 'CLEAR',
        road_type: 'FOUR_LANE',
        latitude: 26.1445,
        longitude: 91.7362,
        accident_timestamp: '2026-05-10T14:30:00Z',
      },
      created_at: new Date().toISOString(),
    };

    // Event 2: Simple accident in Kamrup Metro at nearby location (Blackspot cluster)
    const event2 = {
      id: randomUUID(),
      aggregate_id: accidentId2,
      event_type: 'ACCIDENT_REPORT_CREATED',
      payload: {
        id: accidentId2,
        report_number: 'REP-KM-002',
        district: 'Kamrup Metropolitan',
        police_station: 'Dispur PS',
        collision_type: 'REAR_END',
        severity: 'SIMPLE',
        fatalities: 0,
        injuries: 1,
        vehicles: [{ id: 'v3' }],
        weather: 'RAIN',
        road_type: 'FOUR_LANE',
        latitude: 26.1448, // within ~100m
        longitude: 91.7364,
        accident_timestamp: '2026-05-11T09:15:00Z',
      },
      created_at: new Date().toISOString(),
    };

    await EventBroker.dispatchInMemory('accident.report.created', event1);
    await EventBroker.dispatchInMemory('accident.report.created', event2);

    // Verify row in DB
    const res = await pool.query('SELECT * FROM spatial_accident_records WHERE id = $1', [accidentId1]);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].severity).toBe('FATAL');
    expect(res.rows[0].fatalities).toBe(2);
    expect(res.rows[0].vehicles_count).toBe(2);
  });

  it('3. GET /api/v1/analytics/summary - should calculate aggregate metrics', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/summary')
      .query({ district: 'Kamrup Metropolitan' });

    expect(res.status).toBe(200);
    expect(res.body.overview).toBeDefined();
    expect(res.body.overview.total_accidents).toBeGreaterThanOrEqual(2);
    expect(res.body.overview.total_fatalities).toBeGreaterThanOrEqual(2);
    expect(res.body.overview.fatal_count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.top_districts)).toBe(true);
  });

  it('4. GET /api/v1/analytics/map-clusters - should return GeoJSON feature collection with strict PII omission', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/map-clusters')
      .query({ district: 'Kamrup Metropolitan' });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features.length).toBeGreaterThanOrEqual(2);

    const feature = res.body.features[0];
    expect(feature.geometry.type).toBe('Point');
    expect(Array.isArray(feature.geometry.coordinates)).toBe(true);
    expect(feature.geometry.coordinates.length).toBe(2);

    // Verify PII omission
    expect(feature.properties.victim_name).toBeUndefined();
    expect(feature.properties.phone_number).toBeUndefined();
    expect(feature.properties.officer_id).toBeUndefined();
    expect(feature.properties.severity).toBeDefined();
  });

  it('5. GET /api/v1/analytics/blackspots - should aggregate high incident cluster hotspots', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/blackspots')
      .query({ district: 'Kamrup Metropolitan', minAccidents: 2 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.blackspots)).toBe(true);
    expect(res.body.blackspots.length).toBeGreaterThanOrEqual(1);

    const spot = res.body.blackspots[0];
    expect(spot.district).toBe('Kamrup Metropolitan');
    expect(spot.total_incidents).toBeGreaterThanOrEqual(2);
    expect(spot.risk_priority_score).toBeGreaterThanOrEqual(5);
  });

  it('6. GET /api/v1/analytics/trends - should group accident statistics by month', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends')
      .query({ district: 'Kamrup Metropolitan' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.trends)).toBe(true);
    expect(res.body.trends.length).toBeGreaterThanOrEqual(1);
    expect(res.body.trends[0].month).toBe('2026-05');
  });
});
