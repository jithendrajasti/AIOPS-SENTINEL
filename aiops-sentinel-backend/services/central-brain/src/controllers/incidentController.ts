import { Router } from 'express';
import type { Response } from 'express';
import { getPool } from '../config/database';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../sockets/socketHandler';

export const incidentRouter = Router();

// ── GET /api/incidents ─────────────────────────────────────────────────────────

incidentRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { status, severity, service, q } = req.query as Record<string, string | undefined>;
    const pool = getPool();
    const platformId = req.user?.platformId;

    if (!platformId) {
      res.status(401).json({ error: 'Unauthorized: No platform ID found' });
      return;
    }

    const conditions: string[] = [`"platformId" = $1`];
    const params: unknown[] = [platformId];
    let idx = 2;

    if (status && status !== 'all')   { conditions.push(`status = $${idx++}`);   params.push(status); }
    if (severity && severity !== 'all') { conditions.push(`severity = $${idx++}`); params.push(severity.toUpperCase()); }
    if (service && service !== 'all') { conditions.push(`service = $${idx++}`);  params.push(service); }
    if (q) {
      conditions.push(`(title ILIKE $${idx} OR service ILIKE $${idx} OR code ILIKE $${idx} OR "rootCause" ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM "Incident" ${where} ORDER BY "createdAt" DESC`,
      params,
    );

    res.json({ incidents: rows.map(serialize) });
  } catch (err) {
    console.error('[IncidentController] GET /incidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// ── GET /api/incidents/:id ─────────────────────────────────────────────────────

incidentRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const platformId = req.user?.platformId;
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM "Incident" WHERE id = $1 AND "platformId" = $2', [req.params.id, platformId]);
    if (!rows[0]) { res.status(404).json({ error: 'Incident not found' }); return; }
    res.json(serialize(rows[0]));
  } catch {
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// ── PATCH /api/incidents/:id/status ───────────────────────────────────────────

incidentRouter.patch('/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    const allowed = ['open', 'investigating', 'resolved', 'dismissed'];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
      return;
    }
    const platformId = req.user?.platformId;
    const pool = getPool();
    const resolvedAt = status === 'resolved' ? new Date() : null;
    const { rows } = await pool.query(
      `UPDATE "Incident" SET status = $1, "resolvedAt" = COALESCE($2, "resolvedAt") WHERE id = $3 AND "platformId" = $4 RETURNING *`,
      [status, resolvedAt, req.params.id, platformId],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Incident not found' }); return; }
    const updated = serialize(rows[0]);
    try {
      getIO().to(platformId!).emit('incident:update', updated);
    } catch (err) {
      console.error('[IncidentController] emit error:', err);
    }
    res.json({ incident: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// ── Serialise DB row → frontend shape ─────────────────────────────────────────

function serialize(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    service: row.service,
    severity: (row.severity as string).toLowerCase(),
    status: row.status,
    createdAt: (row.createdAt as Date).toISOString(),
    resolvedAt: row.resolvedAt ? (row.resolvedAt as Date).toISOString() : null,
    assignedTo: row.assignedTo,
    environment: row.environment,
    rootCause: row.rootCause,
    suggestedFix: row.suggestedFix,
    confidence: row.confidence,
    affectedSystems: JSON.parse(row.affectedSystems as string) as string[],
    similarCount: row.similarCount,
    impactedUsers: row.impactedUsers,
    errorRate: row.errorRate,
    anomalyId: row.anomalyId,
    recentLogs: JSON.parse(row.recentLogs as string) as unknown[],
  };
}
