import { Router } from 'express';
import type { Response } from 'express';
import { getPool } from '../config/database';
import { getRedisClient } from '../config/redis';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';

export const analyticsRouter = Router();

const CHART_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fb923c',
  '#f472b6', '#a78bfa', '#fbbf24', '#4ade80',
];

analyticsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const range = req.query.range as string || '30d';
    let days = 30;
    if (range === '24h') days = 1;
    else if (range === '1y') days = 365;
    
    const pool = getPool();
    const platformId = req.user?.platformId;

    if (!platformId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const timeAgo = new Date(Date.now() - days * 24 * 3600 * 1_000);

    const [totalRes, criticalRes, resolvedRes, avgRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM "Incident" WHERE "createdAt" >= $1 AND "platformId" = $2', [timeAgo, platformId]),
      pool.query('SELECT COUNT(*) FROM "Incident" WHERE severity = \'CRITICAL\' AND "createdAt" >= $1 AND "platformId" = $2', [timeAgo, platformId]),
      pool.query('SELECT COUNT(*) FROM "Incident" WHERE status = \'resolved\' AND "createdAt" >= $1 AND "platformId" = $2', [timeAgo, platformId]),
      pool.query('SELECT AVG(confidence) FROM "Incident" WHERE "createdAt" >= $1 AND "platformId" = $2', [timeAgo, platformId]),
    ]);

    const totalCount    = parseInt(totalRes.rows[0].count as string, 10);
    const criticalCount = parseInt(criticalRes.rows[0].count as string, 10);
    const resolvedCount = parseInt(resolvedRes.rows[0].count as string, 10);
    const avgConf       = Math.round(parseFloat(avgRes.rows[0].avg as string ?? '0'));

    const analyticsKpis = [
      { id: 'total',      label: 'Total Incidents',    value: String(totalCount),    tone: 'default', icon: 'siren' },
      { id: 'critical',   label: 'Critical Incidents', value: String(criticalCount), trend: criticalCount > 0 ? 'up' : 'down', tone: criticalCount > 0 ? 'danger' : 'success', icon: 'alert-triangle' },
      { id: 'resolved',   label: 'Resolved',           value: String(resolvedCount), tone: resolvedCount > 0 ? 'success' : 'default', icon: 'check-circle' },
      { id: 'confidence', label: 'Avg AI Confidence',  value: `${avgConf}%`,         tone: 'default', icon: 'sparkles' },
    ];

    // Incidents over time
    const dateFormat = range === '24h' ? `TO_CHAR("createdAt", 'YYYY-MM-DD HH24:00')` : `DATE("createdAt")::text`;
    const otRes = await pool.query<{ date: string; count: string }>(
      `SELECT ${dateFormat} AS date, COUNT(*) AS count
       FROM "Incident" WHERE "createdAt" >= $1 AND "platformId" = $2
       GROUP BY ${dateFormat} ORDER BY ${dateFormat} ASC`,
      [timeAgo, platformId],
    );
    const incidentsOverTime = otRes.rows.map(r => ({ date: r.date, incidents: parseInt(r.count, 10) }));

    // By service
    const bySvcRes = await pool.query<{ service: string; count: string }>(
      `SELECT service, COUNT(*) AS count FROM "Incident" WHERE "createdAt" >= $1 AND "platformId" = $2
       GROUP BY service ORDER BY count DESC LIMIT 8`,
      [timeAgo, platformId],
    );
    const svcTotal = bySvcRes.rows.reduce((s, r) => s + parseInt(r.count, 10), 0) || 1;
    const incidentsByService = bySvcRes.rows.map((r, i) => ({
      name: r.service,
      value: Math.round((parseInt(r.count, 10) / svcTotal) * 100),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    // Top root causes by severity
    const sevRes = await pool.query<{ severity: string; count: string }>(
      `SELECT severity, COUNT(*) AS count FROM "Incident" WHERE "createdAt" >= $1 AND "platformId" = $2 GROUP BY severity ORDER BY count DESC`,
      [timeAgo, platformId],
    );
    const topRootCauses = sevRes.rows.map(r => ({ name: r.severity, value: parseInt(r.count, 10) }));

    // MTTR
    const mttrRes = await pool.query<{ resolvedAt: Date; createdAt: Date }>(
      `SELECT "createdAt", "resolvedAt" FROM "Incident"
       WHERE "resolvedAt" IS NOT NULL AND "createdAt" >= $1 AND "platformId" = $2 ORDER BY "resolvedAt" DESC LIMIT 30`,
      [timeAgo, platformId],
    );
    const mttrOverTime = mttrRes.rows.map(r => ({
      date: r.resolvedAt.toISOString().split('T')[0],
      mttr: Math.round((r.resolvedAt.getTime() - r.createdAt.getTime()) / 60_000),
    }));

    // Summary — volume from Redis
    const redis = await getRedisClient();
    const nowMinute = Math.floor(Date.now() / 60_000);
    const volKeys = Array.from({ length: 15 }, (_, i) => `aiops:metrics:volume:${nowMinute - i}`);
    const volRaw = await redis.mGet(volKeys);
    const volume = volRaw.map((v, i) => ({
      x: new Date((nowMinute - i) * 60_000).toISOString().slice(11, 16),
      size: Number(v ?? 0),
    })).reverse();

    const topSvcRes = await pool.query<{ service: string; count: string }>(
      `SELECT service, COUNT(*) AS count FROM "Incident" WHERE "platformId" = $1 GROUP BY service ORDER BY count DESC LIMIT 5`,
      [platformId],
    );
    const endpoints = topSvcRes.rows.map(r => ({
      endpoint: r.service,
      affected: parseInt(r.count, 10),
      payload: 0,
    }));

    // Golden record usage stats
    const grStatsRes = await pool.query<{ total: string; total_hits: string; max_hits: string }>(
      `SELECT COUNT(*) AS total, COALESCE(SUM("hitCount"), 0) AS total_hits, COALESCE(MAX("hitCount"), 0) AS max_hits FROM "GoldenRecord"`,
    );
    const totalGR   = parseInt(grStatsRes.rows[0]?.total ?? '0', 10);
    const totalHits = parseInt(grStatsRes.rows[0]?.total_hits ?? '0', 10);
    const reusedRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "GoldenRecord" WHERE "hitCount" > 1`,
    );
    const reusedCount = parseInt(reusedRes.rows[0]?.count ?? '0', 10);
    const reuseRate = totalGR > 0 ? Math.round((reusedCount / totalGR) * 100) : 0;

    const topRecordRes = await pool.query<{ issue: string; hitCount: number }>(
      `SELECT issue, "hitCount" FROM "GoldenRecord" ORDER BY "hitCount" DESC LIMIT 1`,
    );
    const topRecord = topRecordRes.rows[0]
      ? { issue: (topRecordRes.rows[0].issue as string).slice(0, 40), hitCount: topRecordRes.rows[0].hitCount }
      : null;

    const goldenRecordUsage = {
      totalRecords: totalGR,
      totalApplications: totalHits,
      reuseRate,
      topRecord,
    };

    res.json({
      analyticsKpis,
      incidentsOverTime,
      incidentsByService,
      topRootCauses,
      mttrOverTime,
      goldenRecordUsage,
      summary: { endpoints, volume },
    });
  } catch (err) {
    console.error('[AnalyticsController] GET /analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
