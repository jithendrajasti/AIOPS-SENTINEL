import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { getRedisClient } from './config/redis';
import { connectDatabase, disconnectDatabase } from './config/database';
import { startKafkaConsumer } from './services/kafkaConsumer';
import { initSocketHandler } from './sockets/socketHandler';
import { authRouter } from './controllers/authController';
import { incidentRouter } from './controllers/incidentController';
import { servicesRouter } from './controllers/servicesController';
import { analyticsRouter } from './controllers/analyticsController';
import { goldenRecordsRouter } from './controllers/goldenRecordsController';
import { resolutionRouter } from './controllers/resolutionController';
import { assistantRouter } from './controllers/assistantController';
import { resolutionRateLimiter } from './middleware/rateLimiter';
import { validateEnv } from './utils/validateEnv';
import { verifyToken } from './services/authService';

const PORT        = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

(async () => {
  validateEnv();

  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(express.json());

  // Allow frontend dev server to call the API
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  // Socket.IO JWT auth — reject connections without a valid token
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token ?? '';
    if (!token) {
      next(new Error('auth:required'));
      return;
    }
    try {
      verifyToken(token);
      next();
    } catch {
      next(new Error('auth:invalid'));
    }
  });

  // ── Connect data stores ───────────────────────────────────────────────────────
  await connectDatabase();

  let redis: Awaited<ReturnType<typeof getRedisClient>> | null = null;
  try {
    redis = await getRedisClient();
  } catch (err) {
    console.warn('[Server] Redis unavailable — metrics/caching disabled:', (err as Error).message);
  }

  // ── Routes ────────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth',          authRouter);
  app.use('/api/incidents',     incidentRouter);
  app.use('/api/services',      servicesRouter);
  app.use('/api/analytics',     analyticsRouter);
  app.use('/api/golden-records', goldenRecordsRouter);
  app.use('/api/resolution',    resolutionRateLimiter, resolutionRouter);
  app.use('/api/assistant',     assistantRouter);

  // ── Socket.IO handlers ────────────────────────────────────────────────────────
  initSocketHandler(io);

  let kafkaHandle: { disconnect: () => Promise<void> } = { disconnect: async () => {} };
  try {
    kafkaHandle = await startKafkaConsumer(io);
  } catch (err) {
    console.warn('[Server] Kafka unavailable — live log ingestion disabled:', (err as Error).message);
  }

  httpServer.listen(PORT, () => {
    console.log(`[Server] AI-Ops Sentinel Central Brain → http://localhost:${PORT}`);
    console.log(
      `[Server] Mode: MOCK_AI=${process.env.MOCK_AI ?? 'false'} | USE_KAFKA=${process.env.USE_KAFKA ?? 'true'}`,
    );
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Server] ${signal} — shutting down...`);
    httpServer.close();
    await kafkaHandle.disconnect();
    if (redis) await redis.quit();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('uncaughtException', (err: Error) => {
    console.error('[Server] Uncaught exception:', err);
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[Server] Unhandled rejection:', reason);
  });
})().catch((err: Error) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});
