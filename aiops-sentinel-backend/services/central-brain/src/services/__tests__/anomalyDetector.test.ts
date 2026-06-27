import { detectAnomaly } from '../anomalyDetector';
import type { LogMessage } from '../../types/index';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeLog(raw: string, source = 'test.log'): LogMessage {
  return { timestamp: new Date().toISOString(), source, raw, lineNumber: 1, platformId: 'test-platform' };
}

function makeWindow(raws: string[]): LogMessage[] {
  return raws.map((raw, i) => ({ ...makeLog(raw), lineNumber: i + 1 }));
}

// ── Severity: Pattern Matching ─────────────────────────────────────────────────

describe('detectAnomaly — pattern matching', () => {
  it('returns CRITICAL severity for FATAL keyword', () => {
    const result = detectAnomaly(makeLog('[FATAL] JVM crash: OOMKiller invoked'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('CRITICAL');
    expect(result?.matchedPattern).toBe('FATAL/CRITICAL keyword');
  });

  it('returns CRITICAL for CRITICAL keyword', () => {
    const result = detectAnomaly(makeLog('CRITICAL: certificate chain broken'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('CRITICAL');
  });

  it('returns HIGH for ECONNREFUSED', () => {
    const result = detectAnomaly(makeLog('Error: ECONNREFUSED 127.0.0.1:5432'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
    expect(result?.matchedPattern).toBe('connection-error');
  });

  it('returns HIGH for connection timeout', () => {
    const result = detectAnomaly(makeLog('Connection timed out after 30s'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
  });

  it('returns HIGH for ETIMEDOUT', () => {
    const result = detectAnomaly(makeLog('Request failed: ETIMEDOUT'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
  });

  it('returns HIGH for resource exhaustion (OOM)', () => {
    const result = detectAnomaly(makeLog('OutOfMemoryError: Java heap space'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
    expect(result?.matchedPattern).toBe('resource-exhaustion');
  });

  it('returns HIGH for disk full', () => {
    const result = detectAnomaly(makeLog('No space left on device: /dev/xvda1'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
  });

  it('returns MEDIUM for ERROR keyword', () => {
    const result = detectAnomaly(makeLog('[ERROR] Failed to parse request body'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('MEDIUM');
    expect(result?.matchedPattern).toBe('error-keyword');
  });

  it('returns LOW for WARN keyword', () => {
    const result = detectAnomaly(makeLog('[WARN] Cache miss ratio above 20%'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('LOW');
    expect(result?.matchedPattern).toBe('warning-keyword');
  });

  it('returns LOW for WARNING keyword', () => {
    const result = detectAnomaly(makeLog('WARNING: deprecated API usage detected'), []);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('LOW');
  });

  it('returns null for clean INFO logs', () => {
    expect(detectAnomaly(makeLog('[INFO] Server started on port 3000'), [])).toBeNull();
  });

  it('returns null for DEBUG logs', () => {
    expect(detectAnomaly(makeLog('[DEBUG] Processing request /api/health'), [])).toBeNull();
  });
});

// ── Priority: First-Match Wins ─────────────────────────────────────────────────

describe('detectAnomaly — rule priority', () => {
  it('FATAL beats ERROR when both are present in the same line', () => {
    const result = detectAnomaly(makeLog('[FATAL] ERROR: unrecoverable state'), []);
    expect(result?.severity).toBe('CRITICAL');
    expect(result?.matchedPattern).toBe('FATAL/CRITICAL keyword');
  });

  it('connection-error beats error-keyword', () => {
    const result = detectAnomaly(makeLog('[ERROR] ECONNREFUSED to redis:6379'), []);
    // ECONNREFUSED rule comes before ERROR rule
    expect(result?.severity).toBe('HIGH');
  });
});

// ── Sliding Window: Error Rate Spike ──────────────────────────────────────────

describe('detectAnomaly — sliding window error rate', () => {
  it('fires HIGH on a 100% error window when current log is clean', () => {
    const window = makeWindow(
      Array.from({ length: 25 }, (_, i) => `[ERROR] Database error #${i}`),
    );
    const result = detectAnomaly(makeLog('[INFO] Heartbeat OK'), window);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
    expect(result?.matchedPattern).toMatch(/^sliding-window-error-rate:100%/);
  });

  it('fires when exactly 40% of a 25-log window are errors', () => {
    const errors = Array.from({ length: 10 }, () => '[ERROR] Oops');
    const infos  = Array.from({ length: 15 }, () => '[INFO] OK');
    const window = makeWindow([...errors, ...infos]);
    const result = detectAnomaly(makeLog('[INFO] Tick'), window);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('HIGH');
  });

  it('does NOT fire when error rate is below 40%', () => {
    const errors = Array.from({ length: 7 }, () => '[ERROR] Oops');   // 7/25 = 28%
    const infos  = Array.from({ length: 18 }, () => '[INFO] OK');
    const window = makeWindow([...errors, ...infos]);
    // incoming log is also clean (no pattern match)
    expect(detectAnomaly(makeLog('[INFO] Tick'), window)).toBeNull();
  });

  it('does NOT fire with fewer than 20 logs in window (insufficient data)', () => {
    const window = makeWindow(
      Array.from({ length: 19 }, () => '[ERROR] Something wrong'),
    );
    // 100% errors but window too small
    expect(detectAnomaly(makeLog('[INFO] Tick'), window)).toBeNull();
  });

  it('fires at exactly the minimum window size of 20', () => {
    const window = makeWindow(
      Array.from({ length: 20 }, () => '[ERROR] Critical failure'),
    );
    expect(detectAnomaly(makeLog('[INFO] OK'), window)).not.toBeNull();
  });
});

// ── Anomaly Shape ──────────────────────────────────────────────────────────────

describe('detectAnomaly — anomaly shape', () => {
  it('includes all required fields', () => {
    const log = makeLog('[ERROR] Disk write failure');
    const result = detectAnomaly(log, []);
    expect(result).toMatchObject({
      id: expect.any(String),
      timestamp: log.timestamp,
      source: log.source,
      severity: 'MEDIUM',
      matchedPattern: 'error-keyword',
      windowErrorRate: expect.any(Number),
      logSnippet: expect.any(String),
    });
  });

  it('caps logSnippet at 500 characters', () => {
    const raw = '[ERROR] ' + 'x'.repeat(600);
    const result = detectAnomaly(makeLog(raw), []);
    expect(result?.logSnippet.length).toBeLessThanOrEqual(500);
  });

  it('includes a non-empty uuid for id', () => {
    const result = detectAnomaly(makeLog('[FATAL] Meltdown'), []);
    expect(result?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('reflects window error rate correctly', () => {
    // 10 errors in a 20-log window = 50%
    const errors = Array.from({ length: 10 }, () => '[ERROR] err');
    const infos  = Array.from({ length: 10 }, () => '[INFO] ok');
    const window = makeWindow([...errors, ...infos]);
    const result = detectAnomaly(makeLog('[INFO] tick'), window);
    expect(result?.windowErrorRate).toBeCloseTo(0.5);
  });

  it('sets windowErrorRate to 0 for empty window', () => {
    const result = detectAnomaly(makeLog('[ERROR] test'), []);
    expect(result?.windowErrorRate).toBe(0);
  });
});

// ── Source Isolation ───────────────────────────────────────────────────────────

describe('detectAnomaly — source handling', () => {
  it('propagates the log source to the anomaly', () => {
    const result = detectAnomaly(makeLog('[FATAL] crash', 'app-server.log'), []);
    expect(result?.source).toBe('app-server.log');
  });
});
