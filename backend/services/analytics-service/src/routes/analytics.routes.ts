import { Router, Request, Response } from 'express';
import { AnalyticsQueryService } from '../services/query.service.js';

export const analyticsRouter = Router();

/**
 * GET /api/v1/analytics/summary
 * Aggregated accident, fatality, injury statistics
 */
analyticsRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const filters = {
      district: req.query.district as string,
      police_station: req.query.police_station as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const summary = await AnalyticsQueryService.getSummary(filters);
    res.json(summary);
  } catch (err: any) {
    console.error('[Analytics Error] /summary failed:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics summary', details: err.message });
  }
});

/**
 * GET /api/v1/analytics/map-clusters
 * GeoJSON FeatureCollection of accident locations with strict PII omission
 */
analyticsRouter.get('/map-clusters', async (req: Request, res: Response) => {
  try {
    const filters = {
      district: req.query.district as string,
      severity: req.query.severity as string,
      bbox: req.query.bbox as string,
    };

    const clusters = await AnalyticsQueryService.getMapClusters(filters);
    res.json(clusters);
  } catch (err: any) {
    console.error('[Analytics Error] /map-clusters failed:', err);
    res.status(500).json({ error: 'Failed to retrieve spatial map clusters', details: err.message });
  }
});

/**
 * GET /api/v1/analytics/blackspots
 * High-frequency accident zones and prioritized danger hotspots
 */
analyticsRouter.get('/blackspots', async (req: Request, res: Response) => {
  try {
    const district = req.query.district as string;
    const minAccidents = req.query.minAccidents ? parseInt(req.query.minAccidents as string, 10) : 2;

    const blackspots = await AnalyticsQueryService.getBlackspots(district, minAccidents);
    res.json(blackspots);
  } catch (err: any) {
    console.error('[Analytics Error] /blackspots failed:', err);
    res.status(500).json({ error: 'Failed to identify blackspot zones', details: err.message });
  }
});

/**
 * GET /api/v1/analytics/trends
 * Temporal trend analysis (monthly counts and casualties)
 */
analyticsRouter.get('/trends', async (req: Request, res: Response) => {
  try {
    const district = req.query.district as string;
    const trends = await AnalyticsQueryService.getTrends(district);
    res.json(trends);
  } catch (err: any) {
    console.error('[Analytics Error] /trends failed:', err);
    res.status(500).json({ error: 'Failed to retrieve trend analytics', details: err.message });
  }
});
