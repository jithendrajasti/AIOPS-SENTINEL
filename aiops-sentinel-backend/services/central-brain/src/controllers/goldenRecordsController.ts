import { Router } from 'express';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { ingestResolution } from '../services/ragPipeline';

export const goldenRecordsRouter = Router();

goldenRecordsRouter.get('/', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM "GoldenRecord" ORDER BY "updatedAt" DESC',
    );

    const records = rows.map(r => ({
      id: r.id as string,
      title: (r.issue as string).slice(0, 60),
      description: (r.resolution as string).slice(0, 100),
      service: r.source as string,
      tags: JSON.parse(r.tags as string) as string[],
      type: 'resolution',
      issue: r.issue as string,
      remediation: r.resolution as string,
      createdBy: 'AI Engine',
      date: (r.createdAt as Date).toISOString(),
      stars: Math.min(5, Math.max(1, Math.ceil((r.hitCount as number) / 2))),
      severity: 'info' as const,
    }));

    res.json({ records });
  } catch (err) {
    console.error('[GoldenRecordsController] GET /golden-records:', err);
    res.status(500).json({ error: 'Failed to fetch golden records' });
  }
});

goldenRecordsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { issue, resolution, source, tags } = req.body as {
      issue?: string;
      resolution?: string;
      source?: string;
      tags?: string[];
    };

    if (!issue?.trim() || !resolution?.trim() || !source?.trim()) {
      res.status(400).json({ error: 'issue, resolution, and source are required' });
      return;
    }

    const tagList = Array.isArray(tags) ? tags.filter(Boolean) : [];

    const result = await ingestResolution({
      anomalyId: '',
      source: source.trim(),
      issue: issue.trim(),
      resolution: resolution.trim(),
      tags: tagList,
    });

    res.status(201).json({
      record: {
        id: result.recordId,
        title: issue.trim().slice(0, 60),
        description: resolution.trim().slice(0, 100),
        service: source.trim(),
        tags: tagList,
        type: 'resolution',
        issue: issue.trim(),
        remediation: resolution.trim(),
        createdBy: 'AI Engine',
        date: new Date().toISOString(),
        stars: 1,
        severity: 'info' as const,
      },
    });
  } catch (err: any) {
    console.error('[GoldenRecordsController] POST /golden-records:', err);
    res.status(500).json({ error: `Failed to create golden record: ${err.message}` });
  }
});

goldenRecordsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    const { rowCount } = await pool.query(
      'DELETE FROM "GoldenRecord" WHERE id = $1',
      [req.params.id],
    );
    if (!rowCount) {
      res.status(404).json({ error: 'Golden record not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[GoldenRecordsController] DELETE /golden-records/:id:', err);
    res.status(500).json({ error: 'Failed to delete golden record' });
  }
});
