import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  Kafka,
  Producer,
  ProducerRecord,
  CompressionTypes,
  logLevel,
} from 'kafkajs';
import type { SASLOptions } from 'kafkajs';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  logFilePath: process.env.LOG_FILE_PATH ?? path.resolve('./sample.log'),
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  kafkaTopic: process.env.KAFKA_TOPIC ?? 'raw-logs',
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'aiops-log-collector',
  useKafka: process.env.USE_KAFKA === 'true',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? '500'),
  platformId: process.env.PLATFORM_ID ?? 'default-platform',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LogMessage {
  readonly timestamp: string;
  readonly source: string;
  readonly raw: string;
  readonly lineNumber: number;
  readonly platformId: string;
}

// A SendStrategy abstracts over mock and Kafka sending — hot path is branchless.
type SendStrategy = (message: LogMessage) => Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// FileTailer — a lightweight EventEmitter that polls a file for new lines
// ─────────────────────────────────────────────────────────────────────────────

interface FileTailerEvents {
  line: (data: string, lineNumber: number) => void;
  error: (err: Error) => void;
}

// Augment EventEmitter so callers get typed .on() / .emit() signatures.
declare interface FileTailer {
  on<K extends keyof FileTailerEvents>(event: K, listener: FileTailerEvents[K]): this;
  emit<K extends keyof FileTailerEvents>(
    event: K,
    ...args: Parameters<FileTailerEvents[K]>
  ): boolean;
}

class FileTailer extends EventEmitter {
  private position: number = 0;
  private lineNumber: number = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly filePath: string,
    private readonly pollIntervalMs: number,
  ) {
    super();
  }

  async start(): Promise<void> {
    // Seek to current EOF on startup — only forward new appended lines.
    const stat = await fs.promises.stat(this.filePath);
    this.position = stat.size;

    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
    console.log(
      `[FileTailer] Watching "${path.basename(this.filePath)}" from byte ${this.position} — poll every ${this.pollIntervalMs}ms`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const stat = await fs.promises.stat(this.filePath);

      // File was truncated or rotated — reset to the beginning.
      if (stat.size < this.position) {
        console.warn('[FileTailer] File rotation detected — resetting position to 0');
        this.position = 0;
      }

      if (stat.size <= this.position) return;

      const bytesToRead = stat.size - this.position;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = await fs.promises.open(this.filePath, 'r');

      try {
        await fd.read(buffer, 0, bytesToRead, this.position);
      } finally {
        await fd.close();
      }

      const chunk = buffer.toString('utf8')
        .replace(/\uFEFF/g, '')   // strip UTF-16LE BOM
        .replace(/\u0000/g, '')   // strip null bytes (PowerShell >> writes UTF-16)
        .replace(/\r/g, '');      // normalise Windows \r\n → \n
      const lines = chunk.split('\n');

      // lines.slice(0,-1) is correct in both cases:
      //   "a\nb\n" → ["a","b",""] → slice → ["a","b"]   (trailing \n, nothing deferred)
      //   "a\nb"   → ["a","b"]    → slice → ["a"]        (no trailing \n, "b" deferred)
      const completeLines = lines.slice(0, -1);
      const incompleteLineBytes = chunk.endsWith('\n')
        ? 0
        : Buffer.byteLength(lines[lines.length - 1], 'utf8');

      for (const line of completeLines) {
        const trimmed = line.trim();
        if (trimmed) {
          this.lineNumber++;
          this.emit('line', trimmed, this.lineNumber);
        }
      }

      this.position = stat.size - incompleteLineBytes;
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SASL Helper — supports Confluent Cloud (plain) and MSK (scram-sha-512)
// ─────────────────────────────────────────────────────────────────────────────

function buildSaslConfig(): SASLOptions | undefined {
  const mechanism = process.env.KAFKA_SASL_MECHANISM;
  if (!mechanism) return undefined;

  const username = process.env.KAFKA_SASL_USERNAME ?? '';
  const password = process.env.KAFKA_SASL_PASSWORD ?? '';

  if (mechanism === 'plain')         return { mechanism: 'plain',         username, password };
  if (mechanism === 'scram-sha-256') return { mechanism: 'scram-sha-256', username, password };
  if (mechanism === 'scram-sha-512') return { mechanism: 'scram-sha-512', username, password };

  console.warn(`[Collector] Unknown SASL mechanism "${mechanism}" — ignoring`);
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Strategies
// ─────────────────────────────────────────────────────────────────────────────

function createMockSender(): SendStrategy {
  return async (message: LogMessage): Promise<void> => {
    console.log(
      `[MOCK] → topic:${CONFIG.kafkaTopic} | line:${message.lineNumber} | ${message.raw}`,
    );
  };
}

interface KafkaSenderHandle {
  sender: SendStrategy;
  disconnect: () => Promise<void>;
}

async function createKafkaSender(): Promise<KafkaSenderHandle> {
  const sasl = buildSaslConfig();
  const kafka = new Kafka({
    clientId: CONFIG.kafkaClientId,
    brokers: CONFIG.kafkaBrokers,
    logLevel: logLevel.WARN,
    ssl: !!sasl,
    sasl,
    retry: {
      initialRetryTime: 300,
      retries: 10,
      multiplier: 1.5,
      maxRetryTime: 30_000,
    },
  });

  const producer: Producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30_000,
  });

  await producer.connect();
  console.log(`[Kafka] Producer connected → ${CONFIG.kafkaBrokers.join(', ')}`);

  const sender: SendStrategy = async (message: LogMessage): Promise<void> => {
    const record: ProducerRecord = {
      topic: CONFIG.kafkaTopic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: message.source,
          value: JSON.stringify(message),
          timestamp: String(Date.now()),
        },
      ],
    };
    await producer.send(record);
  };

  const disconnect = async (): Promise<void> => {
    await producer.disconnect();
    console.log('[Kafka] Producer disconnected cleanly');
  };

  return { sender, disconnect };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Collector
// ─────────────────────────────────────────────────────────────────────────────

async function startCollector(): Promise<void> {
  if (!fs.existsSync(CONFIG.logFilePath)) {
    throw new Error(
      `Log file not found: "${CONFIG.logFilePath}"\n` +
        `  → Set LOG_FILE_PATH in .env or create the file first.`,
    );
  }

  const source = path.basename(CONFIG.logFilePath);
  let sendMessage: SendStrategy;
  let onShutdown: () => Promise<void> = async () => {};

  if (CONFIG.useKafka) {
    console.log('[Collector] Initializing Kafka sender...');
    const handle = await createKafkaSender();
    sendMessage = handle.sender;
    onShutdown = handle.disconnect;
  } else {
    console.log('[Collector] Running in MOCK mode — set USE_KAFKA=true to stream to Kafka');
    sendMessage = createMockSender();
  }

  const tailer = new FileTailer(CONFIG.logFilePath, CONFIG.pollIntervalMs);

  tailer.on('line', (raw: string, lineNumber: number) => {
    // Try to extract the service name from structured JSON logs
    let logSource = source;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.service === 'string' && parsed.service.trim()) {
        logSource = parsed.service.trim();
      }
    } catch {
      // Not JSON — use the filename-based source
    }

    const message: LogMessage = {
      timestamp: new Date().toISOString(),
      source: logSource,
      raw,
      lineNumber,
      platformId: CONFIG.platformId,
    };

    // Fire-and-forget with per-line error isolation — one bad line never kills the stream.
    sendMessage(message).catch((err: Error) => {
      console.error(`[Collector] Send error on line ${lineNumber}: ${err.message}`);
    });
  });

  tailer.on('error', (err: Error) => {
    console.error(`[Collector] Tailer error: ${err.message}`);
  });

  await tailer.start();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Collector] Received ${signal} — shutting down gracefully...`);
    tailer.stop();
    await onShutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('uncaughtException', (err: Error) => {
    console.error('[Collector] Uncaught exception:', err);
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[Collector] Unhandled rejection:', reason);
    void shutdown('unhandledRejection');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────

startCollector().catch((err: Error) => {
  console.error('[Collector] Fatal startup error:', err.message);
  process.exit(1);
});
