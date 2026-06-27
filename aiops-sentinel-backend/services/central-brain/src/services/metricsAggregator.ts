import { getRedisClient } from '../config/redis';
import type { AppMetrics } from '../types/index';

// ── Redis Key Schema ───────────────────────────────────────────────────────────

const KEYS = {
  totalLogs: (platformId: string): string => `aiops:metrics:${platformId}:total_logs`,
  anomalyCount: (platformId: string): string => `aiops:metrics:${platformId}:anomaly_count`,
  errorCount: (platformId: string): string => `aiops:metrics:${platformId}:error_count`,
  activeSources: (platformId: string): string => `aiops:metrics:${platformId}:active_sources`,
  volume: (platformId: string, minuteEpoch: number): string => `aiops:metrics:${platformId}:volume:${minuteEpoch}`,
} as const;

function currentMinuteEpoch(): number {
  return Math.floor(Date.now() / 60_000);
}

// ── Write Helpers ──────────────────────────────────────────────────────────────

export async function incrementTotalLogs(platformId: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.incr(KEYS.totalLogs(platformId));
}

export async function incrementErrorCount(platformId: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.incr(KEYS.errorCount(platformId));
}

export async function incrementAnomalyCount(platformId: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.incr(KEYS.anomalyCount(platformId));
}

export async function trackSource(platformId: string, source: string): Promise<void> {
  const redis = await getRedisClient();
  const key = KEYS.activeSources(platformId);
  await redis.sAdd(key, source);
  await redis.expire(key, 300);
}

export async function trackSourceLog(platformId: string, source: string, isError: boolean): Promise<void> {
  const redis = await getRedisClient();
  const totalKey = `aiops:source:${platformId}:${source}:total`;
  const errorKey = `aiops:source:${platformId}:${source}:errors`;
  await redis.incr(totalKey);
  await redis.expire(totalKey, 900); // 15-min rolling window
  if (isError) {
    await redis.incr(errorKey);
    await redis.expire(errorKey, 900);
  }
}

export async function incrementVolumeForNow(platformId: string): Promise<void> {
  const redis = await getRedisClient();
  const key = KEYS.volume(platformId, currentMinuteEpoch());
  await redis.incr(key);
  await redis.expire(key, 3600);  // 1-hour TTL auto-cleans old minute buckets
}

// ── Read (Dashboard Snapshot) ──────────────────────────────────────────────────

export async function getMetrics(platformId: string): Promise<AppMetrics> {
  const redis = await getRedisClient();

  const [totalLogs, anomalyCount, errorCount, activeSources] = await Promise.all([
    redis.get(KEYS.totalLogs(platformId)).then(v => Number(v ?? 0)),
    redis.get(KEYS.anomalyCount(platformId)).then(v => Number(v ?? 0)),
    redis.get(KEYS.errorCount(platformId)).then(v => Number(v ?? 0)),
    redis.sMembers(KEYS.activeSources(platformId)),
  ]);

  // Fetch volume for the last 5 minute-buckets
  const nowMinute = currentMinuteEpoch();
  const volumeKeys = Array.from({ length: 5 }, (_, i) => KEYS.volume(platformId, nowMinute - i));
  const volumeRaw = await redis.mGet(volumeKeys);

  const volumePerMinute: Record<string, number> = {};
  volumeKeys.forEach((key, i) => {
    const label = key.split(':').pop() ?? String(nowMinute - i);
    volumePerMinute[label] = Number(volumeRaw[i] ?? 0);
  });

  const errorRate = totalLogs > 0
    ? Math.round((errorCount / totalLogs) * 10_000) / 100  // 2 decimal places
    : 0;

  return {
    totalLogs,
    anomalyCount,
    errorCount,
    errorRate,
    activeSources,
    volumePerMinute,
    snapshotAt: new Date().toISOString(),
  };
}
