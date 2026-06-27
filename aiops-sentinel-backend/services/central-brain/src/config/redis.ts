import { createClient } from 'redis';

// Re-export the inferred client type so other modules don't depend on 'redis' directly.
export type RedisClient = ReturnType<typeof createClient>;

let _client: RedisClient | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (_client?.isOpen) return _client;

  _client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  });

  _client.on('error', (err: Error) => console.error('[Redis] Client error:', err.message));
  _client.on('reconnecting', () => console.warn('[Redis] Reconnecting...'));

  await _client.connect();
  console.log('[Redis] Connected');
  return _client;
}
