/**
 * Seed script — inserts test users, incidents, and golden records.
 * Run with:  npx ts-node prisma/seed.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const USERS = [
  { email: 'arjun.dev@aiops-sentinel.io',   name: 'Arjun Dev',       role: 'SRE Lead',            password: 'SentinelSRE@2026' },
  { email: 'priya.ops@aiops-sentinel.io',   name: 'Priya Ops',       role: 'DevOps Engineer',     password: 'SentinelSRE@2026' },
  { email: 'rahul.plat@aiops-sentinel.io',  name: 'Rahul Platform',  role: 'Platform Engineer',   password: 'SentinelSRE@2026' },
];

interface IncidentRow {
  id: string;
  code: string;
  title: string;
  description: string;
  service: string;
  severity: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  assignedTo: string;
  environment: string;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
  affectedSystems: string[];
  similarCount: number;
  impactedUsers: number;
  errorRate: number;
  recentLogs: string;
}

const now = new Date();
const h = (n: number) => new Date(now.getTime() - n * 3_600_000);

const INCIDENTS: IncidentRow[] = [
  {
    id: uuidv4(), code: 'INC-500-1024',
    title: 'Database Connection Pool Exhausted',
    description: 'Connection pool limit (200) exceeded during traffic burst. Failed API calls cascaded across payment pipeline.',
    service: 'payment-service', severity: 'CRITICAL', status: 'open',
    createdAt: h(2), resolvedAt: null, assignedTo: 'Arjun Dev', environment: 'Production',
    rootCause: 'Database connection pool limit exceeded — TCP connection acquire timeout triggered after 4.8s wait.',
    suggestedFix: '1. Raise max_pool_size from 200 to 400.\n2. Enable idle-connection draining (olderThan: 10s).\n3. Add retry-with-jitter on upstream calls.\n4. Configure circuit breaker on payment upstream.',
    confidence: 90, affectedSystems: ['Payment Service', 'Core Service', 'API Gateway'],
    similarCount: 7, impactedUsers: 14300, errorRate: 62.4,
    recentLogs: JSON.stringify([
      { ts: h(2).toISOString(), level: 'ERROR', service: 'payment-service', message: 'PoolExhaustedError: No connection slots available (max_pool_size=200)' },
      { ts: h(2).toISOString(), level: 'ERROR', service: 'payment-service', message: 'Connection acquire timeout after 4800ms' },
      { ts: h(2).toISOString(), level: 'WARN',  service: 'api-gateway',     message: 'Upstream payment-service returned 500 — retrying (1/3)' },
      { ts: h(2).toISOString(), level: 'ERROR', service: 'api-gateway',     message: 'Circuit breaker OPEN for payment-service after 5 consecutive failures' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-503-1023',
    title: 'Circuit Breaker Opened — Upstream Timeout',
    description: 'API Gateway circuit breaker tripped after repeated 503 responses from Core Service. User-facing requests returned 503 for ~12 minutes.',
    service: 'api-gateway', severity: 'HIGH', status: 'investigating',
    createdAt: h(5), resolvedAt: null, assignedTo: 'Priya Ops', environment: 'Production',
    rootCause: 'Core Service overwhelmed by synchronous DB writes without connection pooling. Latency spiked above circuit breaker threshold.',
    suggestedFix: '1. Enable async write queue for non-critical Core Service operations.\n2. Increase circuit breaker threshold from 5 to 10 failures.\n3. Add bulkhead pattern to isolate user-facing endpoints.',
    confidence: 78, affectedSystems: ['API Gateway', 'Core Service'],
    similarCount: 3, impactedUsers: 6200, errorRate: 28.1,
    recentLogs: JSON.stringify([
      { ts: h(5).toISOString(), level: 'WARN',  service: 'api-gateway',  message: 'core-service response time: 8200ms (threshold: 5000ms)' },
      { ts: h(5).toISOString(), level: 'ERROR', service: 'api-gateway',  message: 'Upstream core-service returned HTTP 503' },
      { ts: h(5).toISOString(), level: 'ERROR', service: 'api-gateway',  message: 'Circuit breaker OPEN — state: HALF_OPEN cooldown 30s' },
      { ts: h(5).toISOString(), level: 'ERROR', service: 'core-service', message: 'DB write queue depth: 4200 (capacity: 1000) — shedding load' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-500-1022',
    title: 'OOM Kill — Container Restarted',
    description: 'User Service container killed by OOM killer. JVM heap exceeded 2GB limit. Service restarted automatically but lost in-flight sessions.',
    service: 'user-service', severity: 'CRITICAL', status: 'resolved',
    createdAt: h(24), resolvedAt: h(22), assignedTo: 'Rahul Platform', environment: 'Production',
    rootCause: 'JVM heap unbounded due to memory leak in session cache. G1GC unable to reclaim — triggered OOM kill at 2.1GB RSS.',
    suggestedFix: '1. Set JVM heap: -Xmx1536m -Xms512m.\n2. Add TTL eviction to session cache (max: 30m, size: 10000).\n3. Configure liveness probe restart threshold.\n4. Enable heap dump on OOM for post-mortem.',
    confidence: 95, affectedSystems: ['User Service', 'Auth Service'],
    similarCount: 2, impactedUsers: 8900, errorRate: 100,
    recentLogs: JSON.stringify([
      { ts: h(24).toISOString(), level: 'WARN',  service: 'user-service', message: 'Heap usage: 87% (1.74GB / 2GB) — GC pressure increasing' },
      { ts: h(24).toISOString(), level: 'ERROR', service: 'user-service', message: 'java.lang.OutOfMemoryError: Java heap space' },
      { ts: h(24).toISOString(), level: 'ERROR', service: 'user-service', message: 'Killed by OOM killer — RSS exceeded container limit (2048Mi)' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-429-1021',
    title: 'Rate Limiting Triggered — Auth Service Overloaded',
    description: 'Brute-force login attempt pattern triggered global rate limiter. Legitimate users returned 429 for 8 minutes.',
    service: 'auth-service', severity: 'MEDIUM', status: 'resolved',
    createdAt: h(36), resolvedAt: h(35), assignedTo: 'Priya Ops', environment: 'Production',
    rootCause: 'No IP-based rate limiting. Attacker rotated through /api/auth/login with 3000 req/min from a single subnet. Global limiter triggered at 1500 req/min threshold.',
    suggestedFix: '1. Add IP-level rate limiter (100 req/min per IP).\n2. Add CAPTCHA after 5 failed attempts.\n3. Block /24 subnets with >500 failed attempts.\n4. Alert on unusual auth failure spikes.',
    confidence: 88, affectedSystems: ['Auth Service', 'API Gateway'],
    similarCount: 1, impactedUsers: 2100, errorRate: 41.2,
    recentLogs: JSON.stringify([
      { ts: h(36).toISOString(), level: 'WARN',  service: 'auth-service', message: 'Rate limit approaching: 1200/1500 req/min' },
      { ts: h(36).toISOString(), level: 'ERROR', service: 'auth-service', message: 'Global rate limit EXCEEDED — returning 429 for all clients' },
      { ts: h(36).toISOString(), level: 'WARN',  service: 'auth-service', message: '2847 failed login attempts from 192.168.x.x/24 in last 60s' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-500-1020',
    title: 'Redis Connection Timeout — Session Cache Miss',
    description: 'Redis cluster failover caused 45-second outage. Notification Service fell back to DB queries, causing latency spike.',
    service: 'notification-service', severity: 'HIGH', status: 'resolved',
    createdAt: h(48), resolvedAt: h(47), assignedTo: 'Arjun Dev', environment: 'Production',
    rootCause: 'Redis primary node failed due to disk I/O saturation. Sentinel failover took 45s — beyond the 10s connection timeout configured on clients.',
    suggestedFix: '1. Set client connection timeout to 60s.\n2. Configure Redis Sentinel with 3 replicas (was 1).\n3. Enable lazy-freeing to reduce I/O on eviction.\n4. Add Redis health check to readiness probe.',
    confidence: 92, affectedSystems: ['Notification Service', 'User Service', 'Analytics Service'],
    similarCount: 4, impactedUsers: 3400, errorRate: 34.7,
    recentLogs: JSON.stringify([
      { ts: h(48).toISOString(), level: 'ERROR', service: 'notification-service', message: 'Redis ECONREFUSED 127.0.0.1:6379 — fallback to PostgreSQL' },
      { ts: h(48).toISOString(), level: 'WARN',  service: 'notification-service', message: 'DB query latency: 2400ms (p99 baseline: 120ms)' },
      { ts: h(48).toISOString(), level: 'ERROR', service: 'notification-service', message: 'Redis connection timeout after 10000ms — retrying' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-502-1019',
    title: 'Bad Gateway — Canary Deployment Rollout',
    description: 'Canary release of Core Service v2.3.1 introduced incompatible response schema. 20% of traffic hitting canary returned 502.',
    service: 'core-service', severity: 'HIGH', status: 'resolved',
    createdAt: h(72), resolvedAt: h(70), assignedTo: 'Rahul Platform', environment: 'Production',
    rootCause: 'Core Service v2.3.1 changed the response envelope from `{data}` to `{payload}`. API Gateway schema validation rejected responses — returned 502 to clients.',
    suggestedFix: '1. Add schema compatibility tests to CI pipeline.\n2. Deploy canary with 5% traffic before increasing to 20%.\n3. Roll back immediately on 502 error rate >5%.\n4. Version API responses with Content-Type versioning.',
    confidence: 97, affectedSystems: ['Core Service', 'API Gateway', 'Payment Service'],
    similarCount: 2, impactedUsers: 1800, errorRate: 20.0,
    recentLogs: JSON.stringify([
      { ts: h(72).toISOString(), level: 'ERROR', service: 'api-gateway',  message: 'Upstream schema mismatch: expected {data} got {payload}' },
      { ts: h(72).toISOString(), level: 'ERROR', service: 'api-gateway',  message: 'HTTP 502 Bad Gateway — core-service canary (v2.3.1)' },
      { ts: h(72).toISOString(), level: 'WARN',  service: 'core-service', message: 'Canary v2.3.1 error rate: 19.8% (threshold: 5%)' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-503-1018',
    title: 'Kafka Consumer Lag Spike — Analytics Pipeline',
    description: 'Analytics Service consumer group fell behind by 2.4M messages. Processing latency exceeded 18 minutes. No data loss — only delayed processing.',
    service: 'analytics-service', severity: 'MEDIUM', status: 'resolved',
    createdAt: h(96), resolvedAt: h(94), assignedTo: 'Arjun Dev', environment: 'Production',
    rootCause: 'Analytics Service CPU throttled by cgroup limits during batch aggregation. Consumer throughput dropped from 50K to 8K msg/s, causing lag to accumulate.',
    suggestedFix: '1. Increase CPU limits for analytics-service pod (0.5 → 2.0 cores).\n2. Add consumer lag alert at >100K messages.\n3. Enable parallel consumer threads (1 → 4).\n4. Separate batch aggregation to a dedicated job.',
    confidence: 84, affectedSystems: ['Analytics Service', 'Kafka'],
    similarCount: 1, impactedUsers: 0, errorRate: 0,
    recentLogs: JSON.stringify([
      { ts: h(96).toISOString(), level: 'WARN',  service: 'analytics-service', message: 'Consumer lag: 2,400,000 messages (group: analytics-prod)' },
      { ts: h(96).toISOString(), level: 'WARN',  service: 'analytics-service', message: 'CPU throttled by cgroup — throttle_time: 84%' },
      { ts: h(96).toISOString(), level: 'ERROR', service: 'analytics-service', message: 'Consumer poll timeout — rebalancing triggered' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-500-1017',
    title: 'Disk Usage >90% — Write Operations Failing',
    description: 'Storage Service disk at 92%. New log writes returned ENOSPC. Cascaded to metrics collection and audit trail.',
    service: 'storage-service', severity: 'CRITICAL', status: 'resolved',
    createdAt: h(120), resolvedAt: h(118), assignedTo: 'Rahul Platform', environment: 'Production',
    rootCause: 'Log rotation misconfigured after infrastructure migration. 30-day retention policy not applied — 90 days of uncompressed logs accumulated (380GB).',
    suggestedFix: '1. Apply log rotation: maxSize=100MB, maxAge=30d, compress=true.\n2. Add disk usage alert at >75%.\n3. Schedule weekly log cleanup cron.\n4. Move audit logs to S3 cold storage after 7 days.',
    confidence: 99, affectedSystems: ['Storage Service', 'Analytics Service', 'Notification Service'],
    similarCount: 0, impactedUsers: 0, errorRate: 88.0,
    recentLogs: JSON.stringify([
      { ts: h(120).toISOString(), level: 'ERROR', service: 'storage-service', message: 'ENOSPC: no space left on device — /var/log (92% full)' },
      { ts: h(120).toISOString(), level: 'ERROR', service: 'storage-service', message: 'Write failed: audit.log — disk quota exceeded' },
      { ts: h(120).toISOString(), level: 'WARN',  service: 'storage-service', message: 'Disk usage alert: 92% (threshold: 90%)' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-401-1016',
    title: 'JWT Key Rotation Broke Auth Flow',
    description: 'Rotating JWT signing keys without zero-downtime coordination invalidated active user sessions. 100% of authenticated requests returned 401 for 6 minutes.',
    service: 'auth-service', severity: 'CRITICAL', status: 'resolved',
    createdAt: h(168), resolvedAt: h(167), assignedTo: 'Arjun Dev', environment: 'Production',
    rootCause: 'JWT signing key rotated atomically without overlap period. Tokens signed with old key rejected immediately. No key versioning or grace period implemented.',
    suggestedFix: '1. Implement dual-key rotation: accept both old and new keys for 15-minute overlap.\n2. Store key version in JWT header (kid claim).\n3. Validate incoming tokens against all active keys.\n4. Schedule rotation during low-traffic window.',
    confidence: 99, affectedSystems: ['Auth Service', 'All Services'],
    similarCount: 1, impactedUsers: 28000, errorRate: 100,
    recentLogs: JSON.stringify([
      { ts: h(168).toISOString(), level: 'ERROR', service: 'auth-service', message: 'JWT signature verification failed — key rotated' },
      { ts: h(168).toISOString(), level: 'ERROR', service: 'api-gateway',  message: 'HTTP 401 Unauthorized — all JWT tokens invalid' },
      { ts: h(168).toISOString(), level: 'WARN',  service: 'auth-service', message: 'Key rotation completed — old key no longer accepted' },
    ]),
  },
  {
    id: uuidv4(), code: 'INC-500-1015',
    title: 'gRPC Timeout — Payment Downstream Dependency',
    description: 'Payment Service gRPC calls to Banking Provider timed out. Deadline exceeded after 5s. Transactions queued and retried — eventual consistency maintained.',
    service: 'payment-service', severity: 'HIGH', status: 'resolved',
    createdAt: h(192), resolvedAt: h(190), assignedTo: 'Priya Ops', environment: 'Production',
    rootCause: 'Banking Provider experienced network congestion during peak hours. gRPC deadline set to 5s — below P99 latency of 7.2s during peak.',
    suggestedFix: '1. Increase gRPC deadline to 15s for payment calls.\n2. Add async queue for non-blocking payment processing.\n3. Implement exponential backoff (base: 1s, max: 32s).\n4. Set up Banking Provider SLA dashboard.',
    confidence: 75, affectedSystems: ['Payment Service', 'Banking Provider'],
    similarCount: 3, impactedUsers: 4100, errorRate: 22.3,
    recentLogs: JSON.stringify([
      { ts: h(192).toISOString(), level: 'ERROR', service: 'payment-service', message: 'gRPC DeadlineExceeded: banking-provider /Pay deadline=5s actual=7.2s' },
      { ts: h(192).toISOString(), level: 'WARN',  service: 'payment-service', message: 'Retrying transaction TXN-8842: attempt 2/3' },
      { ts: h(192).toISOString(), level: 'ERROR', service: 'payment-service', message: 'Transaction TXN-8842 failed after 3 retries — queued for manual review' },
    ]),
  },
];

interface GoldenRecordRow {
  id: string;
  pineconeId: string;
  title: string;
  issue: string;
  resolution: string;
  source: string;
  tags: string[];
  hitCount: number;
}

const GOLDEN_RECORDS: GoldenRecordRow[] = [
  {
    id: uuidv4(),
    pineconeId: `golden-seed-pool-001`,
    title: 'Database Connection Pool Saturation',
    issue: 'Database connection pool exhausted under burst load — PoolExhaustedError with connection acquire timeout.',
    resolution: '1. Raise max_pool_size (200 → 400). 2. Enable idle-connection draining (olderThan: 10s). 3. Set connection_timeout to 2000ms. 4. Add circuit breaker on downstream with retry-with-jitter.',
    source: 'payment-service',
    tags: ['database', 'connection-pool', 'payment', 'critical'],
    hitCount: 7,
  },
  {
    id: uuidv4(),
    pineconeId: `golden-seed-circuit-002`,
    title: 'Circuit Breaker — Retry with Jitter Pattern',
    issue: 'Circuit breaker opened due to repeated upstream timeouts. Thundering herd on recovery.',
    resolution: '1. Configure circuit breaker: threshold=10 failures, cooldown=30s. 2. Implement retry with exponential backoff (base: 1s, multiplier: 2, max: 32s, jitter: ±500ms). 3. Add bulkhead pattern to isolate services. 4. Monitor half-open state transitions.',
    source: 'api-gateway',
    tags: ['circuit-breaker', 'resilience', 'retry', 'pattern'],
    hitCount: 5,
  },
  {
    id: uuidv4(),
    pineconeId: `golden-seed-oom-003`,
    title: 'JVM Out of Memory — Heap Tuning',
    issue: 'OOM kill triggered by unbounded JVM heap growth. Session cache memory leak.',
    resolution: '1. Set -Xmx1536m -Xms512m -XX:+UseG1GC. 2. Add TTL eviction to all caches (maxAge: 30m, maxSize: 10000). 3. Enable heap dump on OOM (-XX:+HeapDumpOnOutOfMemoryError). 4. Configure liveness probe: failureThreshold=3, periodSeconds=30. 5. Use WeakHashMap for session caches.',
    source: 'user-service',
    tags: ['jvm', 'oom', 'heap', 'memory-leak', 'k8s'],
    hitCount: 4,
  },
  {
    id: uuidv4(),
    pineconeId: `golden-seed-redis-004`,
    title: 'Redis Failover — Client Reconnection',
    issue: 'Redis primary node failed. Client connection timeout (10s) too short for Sentinel failover (45s).',
    resolution: '1. Set client connectTimeout: 60000ms. 2. Configure Redis Sentinel with 3 replicas. 3. Enable lazy-freeing (lazyfree-lazy-eviction: yes). 4. Add Redis health check to readiness probe. 5. Use connection pooling with min: 5, max: 20.',
    source: 'notification-service',
    tags: ['redis', 'failover', 'sentinel', 'connection-pool'],
    hitCount: 6,
  },
  {
    id: uuidv4(),
    pineconeId: `golden-seed-jwt-005`,
    title: 'JWT Key Rotation — Zero-Downtime Procedure',
    issue: 'Atomic JWT key rotation invalidated all active sessions simultaneously.',
    resolution: '1. Generate new key pair (new-kid). 2. Deploy with JWKS endpoint serving both old-kid and new-kid. 3. Maintain 15-minute overlap: validate tokens against both keys. 4. Issue all new tokens signed with new-kid. 5. After overlap expires, remove old-kid from JWKS. 6. Schedule during lowest-traffic window (02:00–04:00 UTC).',
    source: 'auth-service',
    tags: ['jwt', 'key-rotation', 'auth', 'zero-downtime', 'security'],
    hitCount: 3,
  },
];

async function seed() {
  console.log('[Seed] Starting database seed...');

  // Users
  console.log('[Seed] Creating users...');
  for (const u of USERS) {
    const hashed = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO "User" (id, email, name, role, password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`,
      [uuidv4(), u.email, u.name, u.role, hashed],
    );
    console.log(`  ✓ User: ${u.email} (${u.role}) — password: ${u.password}`);
  }

  // Incidents
  console.log('[Seed] Creating incidents...');
  for (const inc of INCIDENTS) {
    await pool.query(
      `INSERT INTO "Incident"
         (id, code, title, description, service, severity, status, "createdAt", "resolvedAt",
          "assignedTo", environment, "rootCause", "suggestedFix", confidence,
          "affectedSystems", "similarCount", "impactedUsers", "errorRate", "recentLogs")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (code) DO NOTHING`,
      [
        inc.id, inc.code, inc.title, inc.description, inc.service, inc.severity,
        inc.status, inc.createdAt, inc.resolvedAt, inc.assignedTo, inc.environment,
        inc.rootCause, inc.suggestedFix, inc.confidence,
        JSON.stringify(inc.affectedSystems), inc.similarCount, inc.impactedUsers,
        inc.errorRate, inc.recentLogs,
      ],
    );
    console.log(`  ✓ Incident: ${inc.code} — ${inc.title}`);
  }

  // Golden Records
  console.log('[Seed] Creating golden records...');
  for (const gr of GOLDEN_RECORDS) {
    await pool.query(
      `INSERT INTO "GoldenRecord"
         (id, "pineconeId", title, issue, resolution, source, tags, "hitCount", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       ON CONFLICT ("pineconeId") DO NOTHING`,
      [
        gr.id, gr.pineconeId, gr.title, gr.issue, gr.resolution,
        gr.source, JSON.stringify(gr.tags), gr.hitCount,
      ],
    );
    console.log(`  ✓ GoldenRecord: ${gr.title}`);
  }

  console.log('[Seed] Done! Test credentials:');
  console.log('  arjun.dev@aiops-sentinel.io  / SentinelSRE@2026');
  console.log('  priya.ops@aiops-sentinel.io  / SentinelSRE@2026');
  console.log('  rahul.plat@aiops-sentinel.io / SentinelSRE@2026');

  await pool.end();
}

seed().catch((err: Error) => {
  console.error('[Seed] Failed:', err.message);
  process.exit(1);
});
