import { randomUUID } from 'crypto';
import type { LogMessage, Anomaly, AnomalySeverity } from '../types/index';

// ── Detection Rules ────────────────────────────────────────────────────────────
// Evaluated in priority order — first match wins.

interface DetectionRule {
  readonly pattern: RegExp;
  readonly severity: AnomalySeverity;
  readonly label: string;
}

const RULES: readonly DetectionRule[] = [
  {
    pattern: /\b(FATAL|CRITICAL)\b/i,
    severity: 'CRITICAL',
    label: 'FATAL/CRITICAL keyword',
  },
  {
    pattern: /connection\s+(refused|reset|timed?\s*out)|ECONNREFUSED|ETIMEDOUT|ECONNRESET/i,
    severity: 'HIGH',
    label: 'connection-error',
  },
  {
    pattern: /deadlock|out\s+of\s+memory|OutOfMemoryError|OOMKilled|disk\s+full|no\s+space\s+left/i,
    severity: 'HIGH',
    label: 'resource-exhaustion',
  },
  {
    pattern: /\bERROR\b/i,
    severity: 'MEDIUM',
    label: 'error-keyword',
  },
  {
    pattern: /\bWARN(?:ING)?\b/i,
    severity: 'LOW',
    label: 'warning-keyword',
  },
];

// Pattern used only for window error-rate calculation
const ERROR_PATTERN = /\b(ERROR|FATAL|CRITICAL)\b/i;
const WINDOW_ERROR_RATE_THRESHOLD = 0.4;   // 40% of window must be errors
const WINDOW_MIN_SIZE = 20;                // need at least 20 logs to fire rate-spike

// ── Pure Detection Function ────────────────────────────────────────────────────
// No I/O — takes a log + the caller's sliding window, returns an Anomaly or null.
// Caller (kafkaConsumer) owns the window; this stays trivially testable.

export function detectAnomaly(
  log: LogMessage,
  window: readonly LogMessage[],
): Anomaly | null {
  const errorCount = window.filter(l => ERROR_PATTERN.test(l.raw)).length;
  const windowErrorRate = window.length > 0 ? errorCount / window.length : 0;

  const build = (severity: AnomalySeverity, label: string): Anomaly => ({
    id: randomUUID(),
    timestamp: log.timestamp,
    source: log.source,
    severity,
    matchedPattern: label,
    windowErrorRate,
    logSnippet: log.raw.slice(0, 500),
    platformId: log.platformId,
  });

  // Priority 1: direct pattern match on the incoming log
  for (const rule of RULES) {
    if (rule.pattern.test(log.raw)) {
      return build(rule.severity, rule.label);
    }
  }

  // Priority 2: sliding-window error rate spike (no pattern match needed)
  if (window.length >= WINDOW_MIN_SIZE && windowErrorRate >= WINDOW_ERROR_RATE_THRESHOLD) {
    return build(
      'HIGH',
      `sliding-window-error-rate:${Math.round(windowErrorRate * 100)}%`,
    );
  }

  return null;
}
