// Runs at startup — catches misconfigured production deployments before any
// network connections are attempted. No-op in development.
export function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  if (!process.env.GEMINI_API_KEY && process.env.MOCK_AI !== 'true') {
    errors.push('GEMINI_API_KEY is required in production (or set MOCK_AI=true)');
  }
  if (!process.env.PINECONE_API_KEY && process.env.MOCK_AI !== 'true') {
    errors.push('PINECONE_API_KEY is required in production (or set MOCK_AI=true)');
  }
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required in production');
  }
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required in production');
  }
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
    errors.push('CORS_ORIGIN must be set to your frontend domain in production — never use "*"');
  }

  if (errors.length > 0) {
    throw new Error(
      `[validateEnv] Startup aborted — environment is not production-ready:\n` +
      errors.map(e => `  • ${e}`).join('\n'),
    );
  }
}
