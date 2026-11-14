import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { authRouter } from './routes/auth.routes.js';
import { runMigrations } from './config/migrate.js';

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'CrashScribe Auth & Staff Service',
    port: config.port,
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes (handles both /api/v1/auth and direct /auth)
app.use('/api/v1/auth', authRouter);
app.use('/auth', authRouter);

export async function startServer() {
  try {
    // Run DB schema migrations on startup
    await runMigrations();

    const server = app.listen(config.port, () => {
      console.log(`[Auth Service Listening] http://localhost:${config.port}`);
      console.log(`[Health Endpoint] http://localhost:${config.port}/health`);
    });

    return server;
  } catch (err) {
    console.error('[Auth Service Fatal] Failed to start:', err);
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
