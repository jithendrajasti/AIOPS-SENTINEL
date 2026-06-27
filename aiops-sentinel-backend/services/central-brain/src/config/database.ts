import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function connectDatabase(): Promise<void> {
  await getPool().query('SELECT 1');
  console.log('[Database] PostgreSQL connected via pg');
}

export async function disconnectDatabase(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    console.log('[Database] PostgreSQL disconnected');
  }
}
