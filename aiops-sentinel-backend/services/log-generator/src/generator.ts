import 'dotenv/config';
import { Kafka, Producer, logLevel } from 'kafkajs';

// ── Config ─────────────────────────────────────────────────────────────────────

const BROKERS       = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
const TOPIC         = 'raw-logs';
const INTERVAL_MS   = Number(process.env.LOG_INTERVAL_MS   ?? 300);
const BURST_MS      = Number(process.env.BURST_INTERVAL_MS ?? 30_000);
const BURST_SIZE    = Number(process.env.BURST_SIZE        ?? 25);

// ── Simulated services ─────────────────────────────────────────────────────────

const SERVICES = [
  'api-gateway',
  'payment-service',
  'user-service',
  'auth-service',
  'notification-service',
];

// ── Log patterns by level ──────────────────────────────────────────────────────

type PatternFn = (svc: string, id: number) => string;

const NORMAL: PatternFn[] = [
  (svc, id) => `[INFO] GET /api/${svc}/health 200 ${8 + (id % 20)}ms req-${id}`,
  (svc, id) => `[INFO] POST /api/${svc}/process 201 ${30 + (id % 40)}ms req-${id}`,
  (svc) => `[DEBUG] Cache hit for key ${svc}:session:${Math.random().toString(36).slice(2, 8)}`,
  () => `[INFO] Database connection pool: ${1 + (Date.now() % 5)}/10 active`,
  () => `[INFO] Health check OK uptime 99.${80 + (Date.now() % 20)}%`,
  (svc) => `[INFO] Worker thread idle in ${svc}, waiting for tasks`,
  () => `[INFO] Scheduled job completed: cleanup-expired-sessions`,
];

const WARN: PatternFn[] = [
  (svc) => `[WARN] Response time exceeded threshold: ${200 + Math.floor(Math.random() * 300)}ms in ${svc}`,
  () => `[WARN] Connection pool usage above 80%: 8/10 active`,
  () => `[WARN] Retry attempt 2/3 for downstream service call`,
  (svc) => `[WARN] Cache miss ratio above 30% in ${svc}`,
  () => `[WARN] Memory usage: ${70 + Math.floor(Math.random() * 15)}% of available heap`,
  (svc) => `[WARN] Queue depth rising in ${svc}: ${50 + Math.floor(Math.random() * 100)} pending`,
];

const ERROR: PatternFn[] = [
  (svc) => `[ERROR] Database query failed in ${svc}: timeout after 5000ms`,
  () => `[ERROR] Failed to acquire distributed lock: key=user:profile:update`,
  (svc) => `[ERROR] HTTP 500 in ${svc}: unhandled exception at /api/checkout`,
  () => `[ERROR] Redis connection failed: ETIMEDOUT 10.0.0.6:6379`,
  (svc) => `[ERROR] Message queue full in ${svc}, dropping 12 events`,
  () => `[ERROR] JWT verification failed: signature mismatch`,
];

const CRITICAL: PatternFn[] = [
  (svc) => `[FATAL] Connection pool exhausted in ${svc}: ECONNREFUSED localhost:5432`,
  (svc) => `[CRITICAL] OutOfMemoryError in ${svc}: Java heap space exceeded 2GB limit`,
  (svc) => `[FATAL] Circuit breaker OPEN for ${svc}: 5 consecutive failures in 10s`,
  () => `[CRITICAL] Disk usage 95%: No space left on device /dev/xvda1`,
  (svc) => `[FATAL] Authentication service unreachable from ${svc}: ETIMEDOUT 10.0.0.5:8080`,
  (svc) => `[CRITICAL] Database replication lag: 45s behind primary in ${svc}`,
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickService(): string {
  return pick(SERVICES);
}

function buildLog(svc: string, id: number): string {
  const r = Math.random();
  // Weight distribution: 68% normal, 22% warn, 8% error, 2% critical
  if (r < 0.68) return pick(NORMAL)(svc, id);
  if (r < 0.90) return pick(WARN)(svc, id);
  if (r < 0.98) return pick(ERROR)(svc, id);
  return pick(CRITICAL)(svc, id);
}

interface LogMessage {
  timestamp: string;
  source: string;
  raw: string;
  lineNumber: number;
}

// ── Kafka producer ─────────────────────────────────────────────────────────────

async function createProducer(): Promise<Producer> {
  const kafka = new Kafka({
    clientId: 'aiops-log-generator',
    brokers: BROKERS,
    logLevel: logLevel.WARN,
    retry: { initialRetryTime: 300, retries: 8 },
  });

  const producer = kafka.producer();
  await producer.connect();
  console.log('[Generator] Connected to Kafka →', BROKERS.join(', '));
  return producer;
}

async function send(producer: Producer, msg: LogMessage): Promise<void> {
  await producer.send({
    topic: TOPIC,
    messages: [{ value: JSON.stringify(msg) }],
  });
}

// ── Main loop ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const producer = await createProducer();

  let lineNumber = 1;
  let lastBurst = Date.now();

  console.log(`[Generator] Emitting logs every ${INTERVAL_MS}ms | burst every ${BURST_MS}ms (${BURST_SIZE} lines)`);

  const tick = setInterval(async () => {
    const now = Date.now();

    // Error burst: inject many errors from one service to trigger anomaly detection
    if (now - lastBurst >= BURST_MS) {
      lastBurst = now;
      const burstSvc = pickService();
      console.log(`[Generator] Injecting error burst (${BURST_SIZE} lines) from ${burstSvc}`);

      for (let i = 0; i < BURST_SIZE; i++) {
        const raw = pick(CRITICAL)(burstSvc, lineNumber);
        await send(producer, {
          timestamp: new Date().toISOString(),
          source: burstSvc,
          raw,
          lineNumber: lineNumber++,
        }).catch((err: Error) => console.error('[Generator] Send error:', err.message));
      }
      return;
    }

    // Normal log tick
    const svc = pickService();
    const raw = buildLog(svc, lineNumber);

    await send(producer, {
      timestamp: new Date().toISOString(),
      source: svc,
      raw,
      lineNumber: lineNumber++,
    }).catch((err: Error) => console.error('[Generator] Send error:', err.message));
  }, INTERVAL_MS);

  const shutdown = async (): Promise<void> => {
    clearInterval(tick);
    await producer.disconnect();
    console.log('[Generator] Disconnected');
    process.exit(0);
  };

  process.on('SIGINT',  () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err: Error) => {
  console.error('[Generator] Fatal:', err.message);
  process.exit(1);
});
