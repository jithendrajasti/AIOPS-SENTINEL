#!/usr/bin/env node
/**
 * generate-logs.js — Writes realistic log lines to sample.log at a
 * configurable rate. Always uses UTF-8. Safe on Windows, macOS, Linux.
 *
 * Usage:
 *   node scripts/generate-logs.js                  # default: 20 lines, 1–2s apart
 *   node scripts/generate-logs.js --count 50       # write 50 lines
 *   node scripts/generate-logs.js --interval 500   # one line every 500ms
 *   node scripts/generate-logs.js --burst           # dump all lines instantly
 */

const fs = require('fs');
const path = require('path');

// ── CLI args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}
const COUNT    = parseInt(flag('count') ?? '20', 10);
const INTERVAL = parseInt(flag('interval') ?? '1500', 10);
const BURST    = args.includes('--burst');

const LOG_FILE = path.resolve(__dirname, '..', 'sample.log');

// ── Log templates ───────────────────────────────────────────────────────────────
const SERVICES = [
  'payment-api', 'auth-service', 'user-service',
  'api-gateway', 'notification-service', 'order-service',
];

const TEMPLATES = [
  // FATAL / CRITICAL
  { level: 'FATAL',    msg: 'Out of memory: heap allocation failed',              svc: 'payment-api' },
  { level: 'CRITICAL', msg: 'Database connection pool exhausted — 0 available',   svc: 'payment-api' },
  { level: 'FATAL',    msg: 'Redis out of memory — OOMKilled by kernel',          svc: 'auth-service' },
  { level: 'CRITICAL', msg: 'SSL certificate expired on upstream',                svc: 'api-gateway' },

  // ERROR
  { level: 'ERROR',    msg: 'Connection refused: ECONNREFUSED 10.0.1.5:5432',     svc: 'payment-api' },
  { level: 'ERROR',    msg: 'Uncaught Exception: Cannot read property of null',   svc: 'user-service' },
  { level: 'ERROR',    msg: 'Timeout after 30000ms waiting for response',         svc: 'api-gateway' },
  { level: 'ERROR',    msg: 'Deadlock detected in transaction #4821',             svc: 'order-service' },
  { level: 'ERROR',    msg: 'Disk full: no space left on device /var/log',        svc: 'notification-service' },
  { level: 'ERROR',    msg: 'JWT verification failed: token expired',             svc: 'auth-service' },
  { level: 'ERROR',    msg: 'Rate limit exceeded for IP 203.0.113.42',            svc: 'api-gateway' },

  // WARN
  { level: 'WARN',     msg: 'Connection pool at 85% capacity',                    svc: 'payment-api' },
  { level: 'WARN',     msg: 'Slow query detected: 2340ms SELECT users',           svc: 'user-service' },
  { level: 'WARNING',  msg: 'Memory usage at 92% — GC pressure increasing',       svc: 'order-service' },
  { level: 'WARN',     msg: 'Retrying Kafka produce after transient error',        svc: 'notification-service' },

  // INFO
  { level: 'INFO',     msg: 'Health check passed — all dependencies healthy',      svc: 'api-gateway' },
  { level: 'INFO',     msg: 'User login successful for user_id=8832',              svc: 'auth-service' },
  { level: 'INFO',     msg: 'Order #ORD-99421 processed successfully',             svc: 'order-service' },
  { level: 'INFO',     msg: 'Cache hit ratio: 94.3%',                              svc: 'user-service' },

  // DEBUG
  { level: 'DEBUG',    msg: 'Request headers: {accept: application/json}',         svc: 'api-gateway' },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeLine() {
  const tmpl = pick(TEMPLATES);
  const ts = new Date().toISOString();
  // 70% chance to use the template's service, 30% random
  const svc = Math.random() < 0.7 ? tmpl.svc : pick(SERVICES);
  return JSON.stringify({
    timestamp: ts,
    level: tmpl.level,
    service: svc,
    message: tmpl.msg,
    traceId: `trace-${Math.random().toString(36).slice(2, 10)}`,
  });
}

// ── Writer ──────────────────────────────────────────────────────────────────────
console.log(`\n[LogSimulator] Writing ${COUNT} log lines to ${LOG_FILE}`);
console.log(`[LogSimulator] Mode: ${BURST ? 'burst (instant)' : `interval (${INTERVAL}ms)`}\n`);

let written = 0;

function writeLine() {
  const line = makeLine();
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  written++;
  const parsed = JSON.parse(line);
  const color = parsed.level === 'FATAL' || parsed.level === 'CRITICAL' ? '\x1b[31m'
    : parsed.level === 'ERROR' ? '\x1b[91m'
    : parsed.level.startsWith('WARN') ? '\x1b[33m'
    : '\x1b[90m';
  console.log(`${color}[${written}/${COUNT}] ${parsed.level.padEnd(8)} ${parsed.service.padEnd(22)} ${parsed.message}\x1b[0m`);

  if (written >= COUNT) {
    console.log(`\n[LogSimulator] ✅ Done — ${COUNT} lines written to sample.log\n`);
    process.exit(0);
  }
}

if (BURST) {
  for (let i = 0; i < COUNT; i++) writeLine();
} else {
  writeLine(); // write first line immediately
  const timer = setInterval(() => {
    writeLine();
  }, INTERVAL);

  // Clean exit on Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log(`\n[LogSimulator] Stopped after ${written} lines.\n`);
    process.exit(0);
  });
}
