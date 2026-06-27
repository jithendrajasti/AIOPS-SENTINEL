import type { Server } from 'socket.io';
import { getKafkaInstance, KAFKA_CONFIG } from '../config/kafka';
import { ensureTopicExists } from '../config/kafkaAdmin';
import { detectAnomaly } from './anomalyDetector';
import { runRcaPipeline } from './ragPipeline';
import * as metrics from './metricsAggregator';
import {
  mapRcaToIncident,
  mapAnomalyToTimelineEvent,
  mapRcaToTimelineEvent,
} from './frontendAdapter';
import { getPool } from '../config/database';
import type { LogMessage } from '../types/index';

const WINDOW_SIZE = 100;
const COOLDOWN_MS = 60_000;
const ERROR_PATTERN = /\b(ERROR|FATAL|CRITICAL)\b/i;

function detectLevel(raw: string): 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' {
  if (/\b(FATAL|CRITICAL|ERROR)\b/i.test(raw)) return 'ERROR';
  if (/\bWARN(ING)?\b/i.test(raw)) return 'WARN';
  if (/\bDEBUG\b/i.test(raw)) return 'DEBUG';
  return 'INFO';
}

export interface KafkaConsumerHandle {
  disconnect: () => Promise<void>;
}

export async function startKafkaConsumer(io: Server): Promise<KafkaConsumerHandle> {
  if (!KAFKA_CONFIG.useKafka) {
    console.warn('[KafkaConsumer] USE_KAFKA=false — consumer not started. No log processing will occur.');
    return { disconnect: async () => {} };
  }

  // Guarantee the topic exists before subscribing — critical for MSK/Confluent
  // where auto-create is disabled. No-op when the topic already exists.
  await ensureTopicExists();

  const consumer = getKafkaInstance().consumer({
    groupId: KAFKA_CONFIG.groupId,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_CONFIG.topic, fromBeginning: false });
  console.log(`[KafkaConsumer] Subscribed to topic "${KAFKA_CONFIG.topic}"`);

  // Per-source sliding windows and RCA cooldowns
  const windows = new Map<string, LogMessage[]>();
  const cooldowns = new Map<string, number>();

  await consumer.run({
    eachMessage: async ({ message }) => {
      // ── Parse ──────────────────────────────────────────────────────────────────
      if (!message.value) return;

      let log: LogMessage;
      try {
        log = JSON.parse(message.value.toString()) as LogMessage;
      } catch {
        // Never throw inside eachMessage — KafkaJS would retry the message forever
        console.warn('[KafkaConsumer] Skipping malformed message');
        return;
      }

      // ── Update per-source sliding window ───────────────────────────────────────
      const window = windows.get(log.source) ?? [];
      window.push(log);
      if (window.length > WINDOW_SIZE) window.shift();
      windows.set(log.source, window);

      // ── Track metrics (parallel, fire-and-forget) ──────────────────────────────
      const isError = ERROR_PATTERN.test(log.raw);
      const metricTasks: Promise<void>[] = [
        metrics.incrementTotalLogs(log.platformId),
        metrics.trackSource(log.platformId, log.source),
        metrics.incrementVolumeForNow(log.platformId),
        metrics.trackSourceLog(log.platformId, log.source, isError),
      ];
      if (isError) {
        metricTasks.push(metrics.incrementErrorCount(log.platformId));
      }
      Promise.all(metricTasks).catch((err: Error) => {
        console.error('[KafkaConsumer] Metrics error:', err.message);
      });

      // ── Anomaly detection ──────────────────────────────────────────────────────
      const anomaly = detectAnomaly(log, window);
      if (!anomaly) return;

      metrics.incrementAnomalyCount(anomaly.platformId).catch((err: Error) => {
        console.error('[KafkaConsumer] Anomaly count error:', err.message);
      });

      // Broadcast immediately to specific tenant's room
      io.to(anomaly.platformId).emit('anomaly:detected', anomaly);
      io.to(anomaly.platformId).emit('timeline:event', mapAnomalyToTimelineEvent(anomaly));
      console.log(
        `[KafkaConsumer] Anomaly: ${anomaly.severity} | ${anomaly.source} | ${anomaly.matchedPattern}`,
      );

      // ── RCA Cooldown ───────────────────────────────────────────────────────────
      const lastFired = cooldowns.get(log.source) ?? 0;
      if (Date.now() - lastFired < COOLDOWN_MS) return;
      cooldowns.set(log.source, Date.now());

      // ── RCA Pipeline (fire-and-forget — never block the consumer loop) ─────────
      // Capture window snapshot for log storage (last 10 lines max)
      const windowSnapshot = window.slice(-10);

      runRcaPipeline(anomaly)
        .then(async rca => {
          const frontendIncident = mapRcaToIncident(rca, anomaly);
          io.to(anomaly.platformId).emit('rca:new', rca);
          io.to(anomaly.platformId).emit('incident:new', frontendIncident);
          io.to(anomaly.platformId).emit('timeline:event', mapRcaToTimelineEvent(rca));
          console.log(`[KafkaConsumer] RCA ready for anomaly ${anomaly.id}`);

          // Persist to PostgreSQL (fire-and-forget, never block the consumer)
          const recentLogs = windowSnapshot.map(l => ({
            ts: l.timestamp,
            level: detectLevel(l.raw),
            service: l.source,
            message: l.raw.slice(0, 200),
          }));

          getPool().query(
            `INSERT INTO "Incident"
               (id, code, title, description, service, severity, status, "createdAt",
                "assignedTo", environment, "rootCause", "suggestedFix", confidence,
                "affectedSystems", "similarCount", "errorRate", "anomalyId", "recentLogs", "platformId")
             VALUES ($1,$2,$3,$4,$5,$6,'open',$7,'AI Engine','Production',$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT (id) DO NOTHING`,
            [
              anomaly.id,
              frontendIncident.code,
              frontendIncident.title,
              rca.rootCause,
              anomaly.source,
              anomaly.severity,
              new Date(anomaly.timestamp),
              rca.rootCause,
              rca.suggestedFix,
              frontendIncident.confidence,
              JSON.stringify(frontendIncident.affectedSystems),
              rca.historicalMatches,
              frontendIncident.errorRate,
              anomaly.id,
              JSON.stringify(recentLogs),
              anomaly.platformId,
            ],
          ).catch((err: Error) => {
            console.error(`[KafkaConsumer] DB save failed for ${anomaly.id}: ${err.message}`);
          });
        })
        .catch((err: Error) => {
          console.error(`[KafkaConsumer] RCA failed for ${anomaly.id}: ${err.message}`);
        });
    },
  });

  return {
    disconnect: async () => {
      await consumer.disconnect();
      console.log('[KafkaConsumer] Disconnected');
    },
  };
}
