import { Kafka, logLevel } from 'kafkajs';
import type { SASLOptions } from 'kafkajs';

export const KAFKA_CONFIG = {
  clientId: process.env.KAFKA_CLIENT_ID ?? 'aiops-central-brain',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  topic: process.env.KAFKA_TOPIC ?? 'raw-logs',
  groupId: process.env.KAFKA_GROUP_ID ?? 'aiops-central-brain-group',
  // Defaults to ON — set USE_KAFKA=false to skip consumer startup in local dev
  useKafka: process.env.USE_KAFKA !== 'false',
} as const;

// Build SASL config when connecting to cloud-managed Kafka (Confluent Cloud, MSK, Upstash).
// Set KAFKA_SASL_MECHANISM=plain|scram-sha-256|scram-sha-512 to activate.
function buildSaslConfig(): SASLOptions | undefined {
  const mechanism = process.env.KAFKA_SASL_MECHANISM;
  if (!mechanism) return undefined;

  const username = process.env.KAFKA_SASL_USERNAME ?? '';
  const password = process.env.KAFKA_SASL_PASSWORD ?? '';

  if (mechanism === 'plain')         return { mechanism: 'plain',         username, password };
  if (mechanism === 'scram-sha-256') return { mechanism: 'scram-sha-256', username, password };
  if (mechanism === 'scram-sha-512') return { mechanism: 'scram-sha-512', username, password };

  console.warn(`[Kafka] Unknown SASL mechanism "${mechanism}" — ignoring`);
  return undefined;
}

let _kafka: Kafka | null = null;

export function getKafkaInstance(): Kafka {
  if (!_kafka) {
    const sasl = buildSaslConfig();
    _kafka = new Kafka({
      clientId: KAFKA_CONFIG.clientId,
      brokers: [...KAFKA_CONFIG.brokers],
      logLevel: logLevel.WARN,
      // Enable SSL automatically whenever SASL is configured
      ssl: !!sasl,
      sasl,
      retry: {
        initialRetryTime: 300,
        retries: 10,
        multiplier: 1.5,
        maxRetryTime: 30_000,
      },
    });
  }
  return _kafka;
}
