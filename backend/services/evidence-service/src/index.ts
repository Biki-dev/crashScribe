import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { evidenceRouter } from './routes/evidence.routes.js';
import { runMigrations } from './config/migrate.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'CrashScribe Evidence Media Service',
    port: config.port,
    storage_provider: config.r2.accountId ? 'cloudflare_r2' : 'local_fallback',
    bucket: config.r2.bucketName,
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes (handles both /api/v1/evidence and direct /evidence)
app.use('/api/v1/evidence', evidenceRouter);
app.use('/evidence', evidenceRouter);

export async function startServer() {
  try {
    await runMigrations();

    const server = app.listen(config.port, () => {
      console.log(`[Evidence Service Listening] http://localhost:${config.port}`);
      console.log(`[Health Endpoint] http://localhost:${config.port}/health`);
    });

    return server;
  } catch (err) {
    console.error('[Evidence Service Fatal] Failed to start:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
