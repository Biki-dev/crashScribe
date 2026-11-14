import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { reportRouter } from './routes/report.routes.js';
import { runMigrations } from './config/migrate.js';
import { EventBroker } from './config/broker.js';
import { OutboxPoller } from './services/outbox.service.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow up to 10mb for batch payloads

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'CrashScribe Report Ingestion & Sync Service',
    port: config.port,
    redis: config.useRedis ? 'ENABLED' : 'IN_MEMORY_FALLBACK',
    broker: config.useRabbitMQ ? 'RABBITMQ' : 'IN_MEMORY',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes (handles both gateway /api/v1/reports and direct /reports)
app.use('/api/v1/reports', reportRouter);
app.use('/reports', reportRouter);

export async function startServer() {
  try {
    await runMigrations();

    // Initialize Event Broker & Launch Outbox CDC Poller
    await EventBroker.initialize();
    OutboxPoller.start();

    const server = app.listen(config.port, () => {
      console.log(`[Report Service Listening] http://localhost:${config.port}`);
      console.log(`[Health Endpoint] http://localhost:${config.port}/health`);
    });

    return server;
  } catch (err) {
    console.error('[Report Service Fatal] Failed to start:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
