import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { AnalyticsIngestionService } from './services/ingestion.service.js';
import { pool } from './config/db.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', async (_req, res) => {
  try {
    const dbRes = await pool.query('SELECT 1');
    res.json({
      status: 'UP',
      service: 'analytics-service',
      database: dbRes.rows.length === 1 ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'DOWN',
      service: 'analytics-service',
      error: err.message,
    });
  }
});

// Analytics endpoints
app.use('/api/v1/analytics', analyticsRouter);

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, async () => {
    console.log(`[Analytics Service] Server running on port ${config.port}`);
    try {
      await AnalyticsIngestionService.startConsumer();
      console.log('[Analytics Service] CDC Consumer attached successfully.');
    } catch (cErr) {
      console.error('[Analytics Service] Failed to initialize CDC Consumer:', cErr);
    }
  });
}
