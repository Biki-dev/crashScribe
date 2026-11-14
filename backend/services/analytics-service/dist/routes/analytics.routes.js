"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = require("express");
const query_service_js_1 = require("../services/query.service.js");
exports.analyticsRouter = (0, express_1.Router)();
/**
 * GET /api/v1/analytics/summary
 * Aggregated accident, fatality, injury statistics
 */
exports.analyticsRouter.get('/summary', async (req, res) => {
    try {
        const filters = {
            district: req.query.district,
            police_station: req.query.police_station,
            severity: req.query.severity,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        };
        const summary = await query_service_js_1.AnalyticsQueryService.getSummary(filters);
        res.json(summary);
    }
    catch (err) {
        console.error('[Analytics Error] /summary failed:', err);
        res.status(500).json({ error: 'Failed to retrieve analytics summary', details: err.message });
    }
});
/**
 * GET /api/v1/analytics/map-clusters
 * GeoJSON FeatureCollection of accident locations with strict PII omission
 */
exports.analyticsRouter.get('/map-clusters', async (req, res) => {
    try {
        const filters = {
            district: req.query.district,
            severity: req.query.severity,
            bbox: req.query.bbox,
        };
        const clusters = await query_service_js_1.AnalyticsQueryService.getMapClusters(filters);
        res.json(clusters);
    }
    catch (err) {
        console.error('[Analytics Error] /map-clusters failed:', err);
        res.status(500).json({ error: 'Failed to retrieve spatial map clusters', details: err.message });
    }
});
/**
 * GET /api/v1/analytics/blackspots
 * High-frequency accident zones and prioritized danger hotspots
 */
exports.analyticsRouter.get('/blackspots', async (req, res) => {
    try {
        const district = req.query.district;
        const minAccidents = req.query.minAccidents ? parseInt(req.query.minAccidents, 10) : 2;
        const blackspots = await query_service_js_1.AnalyticsQueryService.getBlackspots(district, minAccidents);
        res.json(blackspots);
    }
    catch (err) {
        console.error('[Analytics Error] /blackspots failed:', err);
        res.status(500).json({ error: 'Failed to identify blackspot zones', details: err.message });
    }
});
/**
 * GET /api/v1/analytics/trends
 * Temporal trend analysis (monthly counts and casualties)
 */
exports.analyticsRouter.get('/trends', async (req, res) => {
    try {
        const district = req.query.district;
        const trends = await query_service_js_1.AnalyticsQueryService.getTrends(district);
        res.json(trends);
    }
    catch (err) {
        console.error('[Analytics Error] /trends failed:', err);
        res.status(500).json({ error: 'Failed to retrieve trend analytics', details: err.message });
    }
});
