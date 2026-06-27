import type {
  Incident,
  Service,
  GoldenRecord,
  Endpoint,
  LogLine,
  TimelineEvent,
  Comment,
  Deployment,
  KPI,
} from "@/types";

export const currentUser = {
  name: "Arjun Dev",
  role: "SRE Lead",
  email: "arjun.dev@aiops-sentinel.io",
  initials: "AD",
};

export const kpis: KPI[] = [
  {
    id: "critical",
    label: "Critical Incidents",
    value: "2",
    delta: 12,
    trend: "up",
    tone: "danger",
    icon: "alert-triangle",
  },
  {
    id: "logs",
    label: "Logs Processed (Min)",
    value: "1,432",
    delta: 8,
    trend: "down",
    tone: "default",
    icon: "scroll-text",
  },
  {
    id: "latency",
    label: "Avg. Latency (s)",
    value: "3.2s",
    delta: 4,
    trend: "up",
    tone: "warning",
    icon: "activity",
  },
  {
    id: "health",
    label: "System Health",
    value: "99.4%",
    delta: 2,
    trend: "up",
    tone: "success",
    icon: "shield-check",
  },
];

export const incidents: Incident[] = [
  {
    id: "1024",
    code: "INC-500-1024",
    title: "Error 500: Database Connection Timeout",
    description:
      "Database connection pool limit exceeded. This caused an influx of failed API calls across the payment pipeline.",
    service: "Payment Service",
    severity: "critical",
    status: "open",
    createdAt: "2026-06-17T13:58:37Z",
    assignedTo: "Arjun Dev",
    environment: "Production",
    rootCause: "Database connection pool limit exceeded — Timeout",
    confidence: 90,
    affectedSystems: ["Payment Service", "Core Service", "API Gateway"],
    similarCount: 7,
    impactedUsers: 1240,
    errorRate: 12.4,
  },
  {
    id: "1023",
    code: "INC-503-1023",
    title: "Slow queries detected on Orders DB",
    description:
      "Slow query patterns detected against the orders replica. Latency degraded for read-heavy endpoints.",
    service: "Core Service",
    severity: "medium",
    status: "investigating",
    createdAt: "2026-06-17T13:46:12Z",
    assignedTo: "Priya Shah",
    environment: "Production",
    rootCause: "Missing composite index on orders(created_at, status)",
    confidence: 76,
    affectedSystems: ["Core Service", "Analytics Service"],
    similarCount: 4,
    impactedUsers: 320,
    errorRate: 2.1,
  },
  {
    id: "1022",
    code: "INC-500-1022",
    title: "Critical API Error on Checkout",
    description:
      "Database connection timeout surfaced during checkout. Threshold exceeded on the payment gateway.",
    service: "Payment Service",
    severity: "critical",
    status: "open",
    createdAt: "2026-06-17T13:40:02Z",
    assignedTo: "Ram Singh",
    environment: "Production",
    rootCause: "Upstream payment provider rate limiting",
    confidence: 84,
    affectedSystems: ["Payment Service", "Notification Service"],
    similarCount: 5,
    impactedUsers: 890,
    errorRate: 9.7,
  },
  {
    id: "1021",
    code: "INC-429-1021",
    title: "Rate limit breach on Notification Service",
    description:
      "Notification dispatch queue saturated, leading to delayed delivery and 429 responses.",
    service: "Notification Service",
    severity: "high",
    status: "investigating",
    createdAt: "2026-06-17T12:58:00Z",
    assignedTo: "Priya Shah",
    environment: "Production",
    rootCause: "Burst traffic exceeded provider quota",
    confidence: 71,
    affectedSystems: ["Notification Service"],
    similarCount: 3,
    impactedUsers: 150,
    errorRate: 4.5,
  },
  {
    id: "1020",
    code: "INC-200-1020",
    title: "Memory leak in AI Brain Service",
    description:
      "Gradual heap growth observed in the AI Brain Service workers over a 6-hour window.",
    service: "AI Brain Service",
    severity: "low",
    status: "resolved",
    createdAt: "2026-06-16T22:10:00Z",
    assignedTo: "Arjun Dev",
    environment: "Staging",
    rootCause: "Unbounded embedding cache",
    confidence: 88,
    affectedSystems: ["AI Brain Service"],
    similarCount: 2,
    impactedUsers: 0,
    errorRate: 0.4,
  },
];

export const incidentLogs: LogLine[] = [
  { ts: "13:58:37.214", level: "ERROR", service: "payment-svc", message: "DB connection pool exhausted (max=200, active=200)" },
  { ts: "13:58:37.198", level: "WARN", service: "payment-svc", message: "Connection acquire wait time 4821ms exceeds threshold" },
  { ts: "13:58:36.901", level: "ERROR", service: "api-gateway", message: "Upstream 500 from payment-svc /charge" },
  { ts: "13:58:36.540", level: "INFO", service: "core-svc", message: "Retrying transaction tx_9f23a (attempt 3/3)" },
  { ts: "13:58:35.882", level: "ERROR", service: "payment-svc", message: "psql: FATAL remaining connection slots reserved" },
  { ts: "13:58:35.110", level: "WARN", service: "core-svc", message: "Circuit breaker half-open for payment-svc" },
  { ts: "13:58:34.673", level: "DEBUG", service: "ai-brain", message: "Embedding similarity search returned 7 matches" },
  { ts: "13:58:33.221", level: "ERROR", service: "payment-svc", message: "Transaction tx_9f23a rolled back: timeout" },
];

export const incidentTimeline: TimelineEvent[] = [
  { ts: "13:58:37Z", title: "Incident detected", description: "Collector flagged a spike in 500 errors on Payment Service.", type: "detected" },
  { ts: "13:58:41Z", title: "AI Root Cause generated", description: "Gemini analysis attributed cause to DB connection pool limit (90% conf).", type: "ai" },
  { ts: "13:59:02Z", title: "Similar incidents found", description: "Pinecone matched 7 historical incidents with shared signature.", type: "alert" },
  { ts: "14:01:18Z", title: "Linked to deployment", description: "Correlated with deploy #482 (payment-svc v2.14.0).", type: "deploy" },
  { ts: "14:04:55Z", title: "Comment added", description: "Arjun Dev: scaling pool to 400 and draining stuck connections.", type: "comment" },
];

export const incidentComments: Comment[] = [
  { id: "c1", author: "Arjun Dev", body: "Scaling the connection pool to 400 and restarting the stuck workers. Watching error rate.", ts: "2026-06-17T14:04:55Z" },
  { id: "c2", author: "Priya Shah", body: "Confirmed the spike correlates with deploy #482. Rolling back is an option if pool change doesn't help.", ts: "2026-06-17T14:08:10Z" },
  { id: "c3", author: "Ram Singh", body: "Provider side looks healthy. This is internal pool saturation, not upstream.", ts: "2026-06-17T14:12:33Z" },
];

export const deployments: Deployment[] = [
  { id: "d1", name: "Deployment #482", status: "critical", service: "payment-svc v2.14.0", at: "2026-06-17T13:30:00Z" },
  { id: "d2", name: "Deployment #481", status: "high", service: "core-svc v1.9.3", at: "2026-06-17T11:02:00Z" },
  { id: "d3", name: "Deployment #480", status: "low", service: "api-gateway v3.1.0", at: "2026-06-16T18:45:00Z" },
];

const spark = () => Array.from({ length: 16 }, () => Math.round(40 + Math.random() * 160));

export const services: Service[] = [
  { id: "payment", name: "Payment Service", status: "degraded", uptime: 99.0, errorRate: 0.0, latency: 1000, icon: "credit-card", sparkline: spark(), dependencies: ["core", "api-gateway", "notification"], incidents: 3 },
  { id: "api-gateway", name: "API Gateway", status: "healthy", uptime: 99.0, errorRate: 0.0, latency: 1300, icon: "network", sparkline: spark(), dependencies: ["core"], incidents: 0 },
  { id: "core", name: "Core Service", status: "healthy", uptime: 99.0, errorRate: 1.0, latency: 3000, icon: "settings", sparkline: spark(), dependencies: ["ai-brain"], incidents: 1 },
  { id: "notification", name: "Notification Service", status: "healthy", uptime: 99.0, errorRate: 0.0, latency: 800, icon: "bell", sparkline: spark(), dependencies: [], incidents: 1 },
  { id: "media", name: "Media Service", status: "down", uptime: 99.0, errorRate: 0.0, latency: 3000, icon: "play", sparkline: spark(), dependencies: ["api-gateway"], incidents: 2 },
  { id: "content", name: "Content Service", status: "healthy", uptime: 99.0, errorRate: 0.0, latency: 1300, icon: "file-text", sparkline: spark(), dependencies: [], incidents: 0 },
  { id: "ai-brain", name: "AI Brain Service", status: "healthy", uptime: 98.0, errorRate: 0.0, latency: 600, icon: "brain", sparkline: spark(), dependencies: [], incidents: 1 },
  { id: "search", name: "Search Service", status: "healthy", uptime: 98.0, errorRate: 0.0, latency: 900, icon: "search", sparkline: spark(), dependencies: ["ai-brain"], incidents: 0 },
  { id: "ingest", name: "Ingest Collector", status: "healthy", uptime: 97.1, errorRate: 0.0, latency: 3000, icon: "download", sparkline: spark(), dependencies: ["kafka"], incidents: 0 },
  { id: "kafka", name: "Kafka Broker", status: "healthy", uptime: 97.1, errorRate: 0.0, latency: 2000, icon: "git-branch", sparkline: spark(), dependencies: [], incidents: 0 },
];

export const topEndpoints: Endpoint[] = [
  { endpoint: "129.105.168.138.01", affected: 100, payload: 238 },
  { endpoint: "129.105.168.138.02", affected: 38, payload: 407 },
  { endpoint: "129.105.168.138.03", affected: 32, payload: 309 },
  { endpoint: "129.105.168.138.04", affected: 27, payload: 512 },
  { endpoint: "129.105.168.138.05", affected: 19, payload: 174 },
];

export const goldenRecords: GoldenRecord[] = Array.from({ length: 18 }).map((_, i) => {
  const services = ["Payment Service", "Core Service", "Notification Service", "AI Brain Service", "API Gateway"];
  const people = ["Ram Singh", "Priya Shah", "Arjun Dev"];
  const tagPool = [["Database", "Timeout"], ["Latency", "Index"], ["RateLimit", "Quota"], ["Memory", "Cache"], ["Network", "DNS"]];
  const remediations = [
    "Increase connection pool size and add drain logic for stuck connections.",
    "Add composite index on hot query path and enable query caching.",
    "Apply token-bucket rate limiting and backoff on provider 429s.",
    "Bound the embedding cache with an LRU eviction policy.",
    "Add retry with jitter and circuit breaker on the upstream call.",
  ];
  const idx = i % 5;
  return {
    id: `gr-${1000 + i}`,
    title: idx % 2 === 0 ? "Database connection pool timeout" : "Incident connection manager saturation",
    description:
      "Database connection pool timeout. Connection acquisition exceeded the configured threshold under burst load.",
    service: services[idx],
    tags: tagPool[idx],
    type: "Incident",
    issue: "Database connection pool timeout",
    remediation: remediations[idx],
    createdBy: people[i % 3],
    date: new Date(Date.now() - i * 86400000 * 1.5).toISOString(),
    stars: 3 + (i % 3),
    severity: (["critical", "high", "medium", "low"] as const)[i % 4],
  };
});

// ---- Chart datasets ----

export const incidentsOverTime = [
  { date: "Jun 11", incidents: 5 },
  { date: "Jun 12", incidents: 9 },
  { date: "Jun 13", incidents: 7 },
  { date: "Jun 14", incidents: 11 },
  { date: "Jun 15", incidents: 21 },
  { date: "Jun 16", incidents: 14 },
  { date: "Jun 17", incidents: 6 },
];

export const incidentsByService = [
  { name: "Payment Service", value: 57, color: "#38bdf8" },
  { name: "Core Service", value: 38, color: "#34d399" },
  { name: "Notification Service", value: 27, color: "#fbbf24" },
  { name: "AI Brain Service", value: 17, color: "#a78bfa" },
  { name: "Others", value: 15, color: "#64748b" },
];

export const mttrOverTime = [
  { date: "Jun 11", mttr: 18 },
  { date: "Jun 12", mttr: 26 },
  { date: "Jun 13", mttr: 12 },
  { date: "Jun 14", mttr: 38 },
  { date: "Jun 15", mttr: 14 },
  { date: "Jun 16", mttr: 22 },
  { date: "Jun 17", mttr: 19 },
];

export const topRootCauses = [
  { name: "DB Pool", value: 22 },
  { name: "Index", value: 16 },
  { name: "RateLimit", value: 11 },
  { name: "Memory", value: 9 },
  { name: "Network", value: 5 },
];

export const payloadSize = Array.from({ length: 12 }).map((_, i) => ({
  x: i * 25,
  size: Math.round(400 + i * 110 + Math.random() * 80),
}));

export const analyticsKpis: KPI[] = [
  { id: "total", label: "Total Incidents", value: "42", icon: "alert-circle", tone: "warning", delta: 6, trend: "up" },
  { id: "mttr", label: "MTTR", value: "18m 42s", icon: "timer", tone: "default", delta: 9, trend: "down" },
  { id: "crit", label: "Critical Issues", value: "6", icon: "alert-triangle", tone: "danger", delta: 3, trend: "up" },
  { id: "golden", label: "Golden Records Saved", value: "28", icon: "shield-check", tone: "success", delta: 12, trend: "up" },
];

export const suggestedPrompts = [
  "Explain incident INC-500-1024",
  "Show similar incidents to the payment timeout",
  "Explain this stack trace",
  "Generate a postmortem for today's outage",
];
