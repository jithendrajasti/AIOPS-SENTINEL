import { getKafkaInstance, KAFKA_CONFIG } from './kafka';

const PARTITIONS   = Number(process.env.KAFKA_TOPIC_PARTITIONS   ?? '3');
const REPLICATION  = Number(process.env.KAFKA_TOPIC_REPLICATION   ?? '1');
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Ensures the raw-logs topic exists before the consumer tries to subscribe.
// Safe to call on every startup — it's a no-op if the topic already exists.
// In dev (docker-compose), auto-create handles this. In production MSK/Confluent
// where auto-create is disabled, this is the explicit guarantee.
export async function ensureTopicExists(): Promise<void> {
  const admin = getKafkaInstance().admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();

    if (existing.includes(KAFKA_CONFIG.topic)) {
      console.log(`[KafkaAdmin] Topic "${KAFKA_CONFIG.topic}" already exists`);
      return;
    }

    await admin.createTopics({
      topics: [
        {
          topic: KAFKA_CONFIG.topic,
          numPartitions: PARTITIONS,
          replicationFactor: REPLICATION,
          configEntries: [
            { name: 'retention.ms',      value: String(RETENTION_MS) },
            { name: 'compression.type',  value: 'gzip' },
            { name: 'cleanup.policy',    value: 'delete' },
          ],
        },
      ],
      waitForLeaders: true,
    });

    console.log(
      `[KafkaAdmin] Created topic "${KAFKA_CONFIG.topic}" ` +
      `(partitions=${PARTITIONS}, replication=${REPLICATION})`,
    );
  } finally {
    await admin.disconnect();
  }
}
