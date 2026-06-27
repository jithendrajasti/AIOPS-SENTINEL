// ── Inbound from log-collector via Kafka ──────────────────────────────────────
// Intentionally duplicated here — log-collector is a separate service with no
// shared package. These shapes must stay in sync manually.
export interface LogMessage {
  readonly timestamp: string;
  readonly source: string;
  readonly raw: string;
  readonly lineNumber: number;
  readonly platformId: string;
}

// ── Anomaly Detection ──────────────────────────────────────────────────────────
export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Anomaly {
  readonly id: string;
  readonly timestamp: string;
  readonly source: string;
  readonly severity: AnomalySeverity;
  readonly matchedPattern: string;
  readonly windowErrorRate: number;
  readonly logSnippet: string;  // capped at 500 chars — safe for socket payloads
  readonly platformId: string;
}

// ── RCA Report ─────────────────────────────────────────────────────────────────
export interface RcaResult {
  readonly anomalyId: string;
  readonly source: string;
  readonly severity: AnomalySeverity;
  readonly rootCause: string;
  readonly suggestedFix: string;
  readonly confidence: number;      // 0.0 – 1.0
  readonly generatedAt: string;
  readonly historicalMatches: number;
}

// ── Live Dashboard Metrics ─────────────────────────────────────────────────────
export interface AppMetrics {
  readonly totalLogs: number;
  readonly anomalyCount: number;
  readonly errorCount: number;
  readonly errorRate: number;       // percentage (0–100)
  readonly activeSources: string[];
  readonly volumePerMinute: Record<string, number>;  // minute-epoch → count
  readonly snapshotAt: string;
}

// ── Resolution Ingestion (Frontend → Backend) ──────────────────────────────────
export interface ResolutionPayload {
  readonly anomalyId: string;
  readonly source: string;
  readonly issue: string;
  readonly resolution: string;
  readonly tags?: string[];
}

// ── Pinecone Golden Record Metadata ───────────────────────────────────────────
// Fields must be compatible with Pinecone RecordMetadataValue: string | number | boolean | string[]
export interface GoldenRecordMetadata {
  issue: string;
  resolution: string;
  source: string;
  hitCount: number;
  createdAt: string;
  expiresAt: number;  // epoch ms — TTL enforced at application layer, not Pinecone
  tags?: string[];
}
