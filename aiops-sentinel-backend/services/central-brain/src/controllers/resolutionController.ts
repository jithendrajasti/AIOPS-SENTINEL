import { Router, type Response } from 'express';
import { ingestResolution } from '../services/ragPipeline';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import type { ResolutionPayload } from '../types/index';

export const resolutionRouter = Router();

// POST /api/resolution
// Validates the developer's resolution, runs the Post-Resolution Pipeline
// (dedup + embed + upsert to Pinecone), and returns the ingested record info.

resolutionRouter.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { anomalyId, source, issue, resolution } = req.body as Partial<ResolutionPayload>;

  if (!anomalyId || !source || !issue || !resolution) {
    res.status(400).json({
      error: 'Missing required fields: anomalyId, source, issue, resolution',
    });
    return;
  }

  try {
    const result = await ingestResolution({ anomalyId, source, issue, resolution });
    res.status(201).json({
      success: true,
      anomalyId,
      action: result.action,
      recordId: result.recordId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ResolutionController] Ingestion failed: ${message}`);
    res.status(500).json({ error: 'Failed to ingest resolution' });
  }
});
