import type { Server, Socket } from 'socket.io';
import { getMetrics } from '../services/metricsAggregator';
import { mapMetricsToKpis } from '../services/frontendAdapter';
import { verifyToken } from '../services/authService';
import { getPool } from '../config/database';

const METRICS_INTERVAL_MS = 3_000;

let ioInstance: Server | null = null;
let metricsInterval: NodeJS.Timeout | null = null;

// Track active platformIds so we only fetch metrics for active platforms
const activePlatforms = new Map<string, number>();

export function initSocketHandler(io: Server): void {
  ioInstance = io;
  
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = verifyToken(token);
      socket.data = { platformId: decoded.platformId };
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const platformId = socket.data.platformId;
    console.log(`[Socket.IO] Client connected: ${socket.id} (Platform: ${platformId})`);
    
    socket.join(platformId);
    
    // Increment active connection count for this platform
    const currentCount = activePlatforms.get(platformId) ?? 0;
    activePlatforms.set(platformId, currentCount + 1);

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
      const count = activePlatforms.get(platformId) ?? 0;
      if (count <= 1) {
        activePlatforms.delete(platformId);
      } else {
        activePlatforms.set(platformId, count - 1);
      }
    });
  });

  // Push a live metrics snapshot to active platforms every 3 seconds
  metricsInterval = setInterval(() => {
    for (const platformId of activePlatforms.keys()) {
      Promise.all([
        getMetrics(platformId),
        getPool().query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM "Incident"
           WHERE "platformId" = $1 AND severity = 'CRITICAL'
           AND status NOT IN ('resolved', 'dismissed')`,
          [platformId],
        ),
      ])
        .then(([data, critRes]) => {
          const criticalOpenCount = parseInt(critRes.rows[0]?.count ?? '0', 10);
          io.to(platformId).emit('metrics:update', data);
          io.to(platformId).emit('kpi:update', mapMetricsToKpis(data, criticalOpenCount));
        })
        .catch((err: Error) => console.error(`[Socket.IO] Metrics push failed for ${platformId}:`, err.message));
    }
  }, METRICS_INTERVAL_MS);
}

export function getIO(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized');
  }
  return ioInstance;
}
