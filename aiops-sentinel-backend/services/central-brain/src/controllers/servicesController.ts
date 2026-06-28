import { Router } from 'express';
import type { Response } from 'express';
import { getRedisClient } from '../config/redis';
import { getPool } from '../config/database';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';

export const servicesRouter = Router();

const SERVICE_ICONS: Record<string, string> = {
  'api-gateway':          'gateway',
  'payment-service':      'credit-card',
  'user-service':         'user',
  'auth-service':         'shield',
  'notification-service': 'bell',
};

function deriveStatus(errorRate: number): string {
  if (errorRate > 0.4) return 'down';
  if (errorRate > 0.15) return 'degraded';
  return 'healthy';
}

servicesRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const redis = await getRedisClient();
    const pool = getPool();
    const platformId = req.user?.platformId;

    if (!platformId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const redisSources = await redis.sMembers(`aiops:metrics:${platformId}:active_sources`);

    const { rows: incidentCounts } = await pool.query<{ service: string; count: string; total: string }>(
      `SELECT service,
              COUNT(*) FILTER (WHERE status != 'resolved') AS count,
              COUNT(*) AS total
       FROM "Incident" WHERE "platformId" = $1 GROUP BY service`,
      [platformId],
    );
    const incidentMap = Object.fromEntries(
      incidentCounts.map(r => [r.service, { active: parseInt(r.count, 10), total: parseInt(r.total, 10) }]),
    );

    // Use Redis-derived sources when available; otherwise fall back to incident services
    const sources = redisSources.length > 0
      ? redisSources
      : incidentCounts.map(r => r.service);

    if (sources.length === 0) {
      res.json({ services: [] });
      return;
    }

    // Fetch Redis metrics (may be empty if log-collector is not running)
    const totalKeys = sources.map(s => `aiops:source:${platformId}:${s}:total`);
    const errorKeys = sources.map(s => `aiops:source:${platformId}:${s}:errors`);
    const [totals, errors] = await Promise.all([
      redis.mGet(totalKeys),
      redis.mGet(errorKeys),
    ]);

    const services = sources.map((source, i) => {
      const total = Number(totals[i] ?? 0);
      const errs  = Number(errors[i] ?? 0);
      // When no Redis metrics: derive from incident history
      const incData = incidentMap[source];
      const errorRate = total > 0
        ? errs / total
        : incData && incData.total > 0
          ? Math.min(incData.active / incData.total, 1)
          : 0;
      const status = deriveStatus(errorRate);
      const uptime = Math.max(0, 100 - errorRate * 100);

      return {
        id: source,
        name: source,
        status,
        uptime: Math.round(uptime * 100) / 100,
        errorRate: Math.round(errorRate * 10_000) / 100,
        latency: 0,
        icon: SERVICE_ICONS[source] ?? 'server',
        sparkline: [],
        dependencies: [],
        incidents: incData?.active ?? 0,
      };
    });

    res.json({ services });
  } catch (err) {
    console.error('[ServicesController] GET /services:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

servicesRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const redis = await getRedisClient();
    const pool = getPool();
    const platformId = req.user?.platformId;

    if (!platformId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [totalRaw, errorsRaw, isMember] = await Promise.all([
      redis.get(`aiops:source:${platformId}:${id}:total`),
      redis.get(`aiops:source:${platformId}:${id}:errors`),
      redis.sIsMember(`aiops:metrics:${platformId}:active_sources`, id),
    ]);

    if (!isMember) {
      res.status(404).json({ error: 'Service not found or inactive' });
      return;
    }

    const total = Number(totalRaw ?? 0);
    const errs  = Number(errorsRaw ?? 0);
    const errorRate = total > 0 ? errs / total : 0;
    const status = deriveStatus(errorRate);

    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "Incident" WHERE service = $1 AND status != 'resolved' AND "platformId" = $2`,
      [id, platformId],
    );
    const incidentCount = parseInt(countRows[0]?.count ?? '0', 10);

    const service = {
      id,
      name: id,
      status,
      uptime: Math.round(Math.max(0, 100 - errorRate * 100) * 100) / 100,
      errorRate: Math.round(errorRate * 10_000) / 100,
      latency: 0,
      icon: SERVICE_ICONS[id] ?? 'server',
      sparkline: [],
      dependencies: [],
      incidents: incidentCount,
    };

    const { rows: recentIncidents } = await pool.query<{
      id: string; code: string; title: string; severity: string; status: string;
    }>(
      `SELECT id, code, title, severity, status FROM "Incident" WHERE service = $1 AND "platformId" = $2 ORDER BY "createdAt" DESC LIMIT 4`,
      [id, platformId],
    );

    res.json({
      service,
      recentIncidents: recentIncidents.map(r => ({
        id: r.id, code: r.code, title: r.title,
        severity: r.severity.toLowerCase(), status: r.status,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});
