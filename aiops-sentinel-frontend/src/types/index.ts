export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type IncidentStatus = "open" | "investigating" | "resolved" | "dismissed";
export type ServiceStatus = "healthy" | "degraded" | "down" | "unhealthy";

export interface KPI {
  id: string;
  label: string;
  value: string;
  delta?: number; // percent change
  trend?: "up" | "down";
  tone?: "default" | "danger" | "success" | "warning";
  icon: string;
}

export interface Incident {
  id: string;
  code: string; // e.g. INC-500-1024
  title: string;
  description: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: string;
  resolvedAt?: string | null;
  assignedTo: string;
  environment: string;
  rootCause: string;
  suggestedFix?: string;
  confidence: number; // 0-100
  affectedSystems: string[];
  similarCount: number;
  impactedUsers: number;
  errorRate: number;
  anomalyId?: string | null;
  recentLogs?: LogLine[];
}

export interface LogLine {
  ts: string;
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  service: string;
  message: string;
}

export interface TimelineEvent {
  ts: string;
  title: string;
  description: string;
  type: "detected" | "ai" | "deploy" | "comment" | "resolved" | "alert";
}

export interface Comment {
  id: string;
  author: string;
  avatar?: string;
  body: string;
  ts: string;
}

export interface Deployment {
  id: string;
  name: string;
  status: Severity;
  service: string;
  at: string;
}

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  uptime: number; // %
  errorRate: number; // %
  latency: number; // ms
  icon: string;
  sparkline: number[];
  dependencies: string[];
  incidents: number;
}

export interface GoldenRecord {
  id: string;
  title: string;
  description: string;
  service: string;
  tags: string[];
  type: string;
  issue: string;
  remediation: string;
  createdBy: string;
  createdByAvatar?: string;
  date: string;
  stars: number; // 0-5
  severity: Severity;
}

export interface Endpoint {
  endpoint: string;
  affected: number;
  payload: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
  streaming?: boolean;
}
