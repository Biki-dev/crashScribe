"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsQueryService = void 0;
const db_js_1 = require("../config/db.js");
class AnalyticsQueryService {
    /**
     * 1. High-level summary metrics (Totals, fatalities, severe counts, etc.)
     */
    static async getSummary(filters) {
        const conditions = ['1=1'];
        const values = [];
        let idx = 1;
        if (filters.district) {
            conditions.push(`district = $${idx++}`);
            values.push(filters.district);
        }
        if (filters.police_station) {
            conditions.push(`police_station = $${idx++}`);
            values.push(filters.police_station);
        }
        if (filters.severity) {
            conditions.push(`severity = $${idx++}`);
            values.push(filters.severity);
        }
        if (filters.startDate) {
            conditions.push(`accident_timestamp >= $${idx++}`);
            values.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push(`accident_timestamp <= $${idx++}`);
            values.push(filters.endDate);
        }
        const whereClause = conditions.join(' AND ');
        const summaryQuery = `
      SELECT
        COUNT(*)::INTEGER AS total_accidents,
        COALESCE(SUM(fatalities), 0)::INTEGER AS total_fatalities,
        COALESCE(SUM(injuries), 0)::INTEGER AS total_injuries,
        COALESCE(SUM(vehicles_count), 0)::INTEGER AS total_vehicles_involved,
        COUNT(*) FILTER (WHERE severity = 'FATAL')::INTEGER AS fatal_count,
        COUNT(*) FILTER (WHERE severity = 'GRIEVOUS')::INTEGER AS grievous_count,
        COUNT(*) FILTER (WHERE severity = 'SIMPLE')::INTEGER AS simple_count
      FROM spatial_accident_records
      WHERE ${whereClause}
    `;
        const districtBreakdownQuery = `
      SELECT 
        district, 
        COUNT(*)::INTEGER AS count,
        COALESCE(SUM(fatalities), 0)::INTEGER AS fatalities
      FROM spatial_accident_records
      WHERE ${whereClause}
      GROUP BY district
      ORDER BY count DESC
      LIMIT 10
    `;
        const [summaryRes, districtRes] = await Promise.all([
            db_js_1.pool.query(summaryQuery, values),
            db_js_1.pool.query(districtBreakdownQuery, values),
        ]);
        return {
            overview: summaryRes.rows[0],
            top_districts: districtRes.rows,
        };
    }
    /**
     * 2. Map coordinates / clusters with strict PII omission
     */
    static async getMapClusters(filters) {
        const conditions = ['1=1'];
        const values = [];
        let idx = 1;
        if (filters.district) {
            conditions.push(`district = $${idx++}`);
            values.push(filters.district);
        }
        if (filters.severity) {
            conditions.push(`severity = $${idx++}`);
            values.push(filters.severity);
        }
        // Optional Bounding Box: minLng,minLat,maxLng,maxLat
        if (filters.bbox) {
            const parts = filters.bbox.split(',').map((p) => parseFloat(p.trim()));
            if (parts.length === 4 && !parts.some(isNaN)) {
                const [minLng, minLat, maxLng, maxLat] = parts;
                conditions.push(`longitude >= $${idx++} AND longitude <= $${idx++}`);
                values.push(minLng, maxLng);
                conditions.push(`latitude >= $${idx++} AND latitude <= $${idx++}`);
                values.push(minLat, maxLat);
            }
        }
        const whereClause = conditions.join(' AND ');
        // Return sanitized point features suitable for GeoJSON / Mapbox / Leaflet
        const query = `
      SELECT 
        id,
        report_number,
        district,
        police_station,
        severity,
        fatalities,
        injuries,
        collision_type,
        latitude::FLOAT AS latitude,
        longitude::FLOAT AS longitude,
        accident_timestamp
      FROM spatial_accident_records
      WHERE ${whereClause}
      ORDER BY accident_timestamp DESC
      LIMIT 500
    `;
        const result = await db_js_1.pool.query(query, values);
        // Format as GeoJSON FeatureCollection
        const features = result.rows.map((row) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [row.longitude, row.latitude],
            },
            properties: {
                id: row.id,
                report_number: row.report_number,
                district: row.district,
                police_station: row.police_station,
                severity: row.severity,
                fatalities: row.fatalities,
                injuries: row.injuries,
                collision_type: row.collision_type,
                timestamp: row.accident_timestamp,
            },
        }));
        return {
            type: 'FeatureCollection',
            count: features.length,
            features,
        };
    }
    /**
     * 3. Blackspot Hotspot identification (spatial density / high fatal intersections)
     * Clusters accidents within ~200-500m radius using coordinate rounding or spatial grouping
     */
    static async getBlackspots(district, minAccidents = 2) {
        const conditions = ['1=1'];
        const values = [];
        let idx = 1;
        if (district) {
            conditions.push(`district = $${idx++}`);
            values.push(district);
        }
        values.push(minAccidents);
        const minParam = `$${idx++}`;
        const whereClause = conditions.join(' AND ');
        // Round coordinates to 3 decimals (~110m resolution) for cluster aggregation
        const query = `
      SELECT
        district,
        police_station,
        ROUND(latitude::NUMERIC, 3)::FLOAT AS cluster_lat,
        ROUND(longitude::NUMERIC, 3)::FLOAT AS cluster_lng,
        COUNT(*)::INTEGER AS total_incidents,
        COALESCE(SUM(fatalities), 0)::INTEGER AS total_fatalities,
        COALESCE(SUM(injuries), 0)::INTEGER AS total_injuries,
        -- Blackspot score: 5 points per fatality, 3 points per grievous, 1 per simple
        (
          (COUNT(*) FILTER (WHERE severity = 'FATAL') * 5) +
          (COUNT(*) FILTER (WHERE severity = 'GRIEVOUS') * 3) +
          (COUNT(*) FILTER (WHERE severity = 'SIMPLE') * 1)
        )::INTEGER AS risk_priority_score
      FROM spatial_accident_records
      WHERE ${whereClause}
      GROUP BY district, police_station, ROUND(latitude::NUMERIC, 3), ROUND(longitude::NUMERIC, 3)
      HAVING COUNT(*) >= ${minParam}
      ORDER BY risk_priority_score DESC, total_incidents DESC
      LIMIT 20
    `;
        const result = await db_js_1.pool.query(query, values);
        return {
            blackspots: result.rows,
            threshold: minAccidents,
        };
    }
    /**
     * 4. Temporal Trends (Monthly/Daily aggregations)
     */
    static async getTrends(district) {
        const conditions = ['1=1'];
        const values = [];
        if (district) {
            conditions.push(`district = $1`);
            values.push(district);
        }
        const whereClause = conditions.join(' AND ');
        const query = `
      SELECT
        TO_CHAR(accident_timestamp, 'YYYY-MM') AS month,
        COUNT(*)::INTEGER AS total_accidents,
        COALESCE(SUM(fatalities), 0)::INTEGER AS fatalities,
        COALESCE(SUM(injuries), 0)::INTEGER AS injuries
      FROM spatial_accident_records
      WHERE ${whereClause}
      GROUP BY TO_CHAR(accident_timestamp, 'YYYY-MM')
      ORDER BY month ASC
      LIMIT 24
    `;
        const result = await db_js_1.pool.query(query, values);
        return {
            trends: result.rows,
        };
    }
}
exports.AnalyticsQueryService = AnalyticsQueryService;
