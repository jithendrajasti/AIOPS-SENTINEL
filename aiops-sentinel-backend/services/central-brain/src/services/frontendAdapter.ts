// Translates internal backend types to the exact shapes the frontend expects
// over Socket.IO. Field names here must match src/types/index.ts in the frontend.

import type { Anomaly, RcaResult, AppMetrics } from '../types/index';

// ── Frontend-side types (mirror of aiops-sentinel-frontend/src/types/index.ts) ─

type FrontendSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface FrontendIncident {
  id: string;
  code: string;
  title: string;
  description: string;
  service: string;
  severity: FrontendSeverity;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  assignedTo: string;
  environment: string;
  rootCause: string;
  confidence: number;   // 0-100
  affectedSystems: string[];
  similarCount: number;
  impactedUsers: number;
  errorRate: number;    // percentage
}

export interface FrontendKPI {
  id: string;
  label: string;
  value: string;
  delta?: number;
  trend?: 'up' | 'down';
  tone?: 'default' | 'danger' | 'success' | 'warning';
  icon: string;
}

export interface FrontendTimelineEvent {
  ts: string;
  title: string;
  description: string;
  type: 'detected' | 'ai' | 'deploy' | 'comment' | 'resolved' | 'alert';
}

// ── Mappers ────────────────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, FrontendSeverity> = {
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
  LOW:      'low',
};

const HTTP_CODE_MAP: Record<FrontendSeverity, string> = {
  critical: '500',
  high:     '503',
  medium:   '429',
  low:      '200',
  info:     '200',
};

export function mapRcaToIncident(rca: RcaResult, anomaly: Anomaly): FrontendIncident {
  const severity: FrontendSeverity = SEVERITY_MAP[anomaly.severity] ?? 'info';
  const shortId = anomaly.id.replace(/-/g, '').slice(-6).toUpperCase();
  const humanTitle = anomaly.matchedPattern
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: anomaly.id,
    code: `INC-${HTTP_CODE_MAP[severity]}-${shortId}`,
    title: `${humanTitle} in ${anomaly.source}`,
    description: rca.rootCause,
    service: anomaly.source,
    severity,
    status: 'open',
    createdAt: anomaly.timestamp,
    assignedTo: 'AI Engine',
    environment: 'Production',
    rootCause: rca.rootCause,
    confidence: Math.round(rca.confidence * 100),
    affectedSystems: [anomaly.source],
    similarCount: rca.historicalMatches,
    impactedUsers: 0,
    errorRate: Math.round(anomaly.windowErrorRate * 10_000) / 100,
  };
}

export function mapAnomalyToTimelineEvent(anomaly: Anomaly): FrontendTimelineEvent {
  return {
    ts: anomaly.timestamp,
    title: `${anomaly.severity} incident detected`,
    description: `Pattern "${anomaly.matchedPattern}" flagged in ${anomaly.source}.`,
    type: 'detected',
  };
}

export function mapRcaToTimelineEvent(rca: RcaResult): FrontendTimelineEvent {
  return {
    ts: rca.generatedAt,
    title: 'AI Root Cause Analysis complete',
    description: rca.rootCause.slice(0, 150),
    type: 'ai',
  };
}

export function mapMetricsToKpis(m: AppMetrics, criticalOpenCount = 0): FrontendKPI[] {
  const currentMinKey = String(Math.floor(Date.now() / 60_000));
  const volNow = m.volumePerMinute[currentMinKey] ?? 0;

  return [
    {
      id: 'critical',
      label: 'Critical Incidents',
      value: String(criticalOpenCount),
      trend: criticalOpenCount > 0 ? 'up' : 'down',
      tone: criticalOpenCount > 0 ? 'danger' : 'success',
      icon: 'alert-triangle',
    },
    {
      id: 'logs',
      label: 'Logs Processed',
      value: m.totalLogs.toLocaleString('en-US'),
      tone: 'default',
      icon: 'scroll-text',
    },
    {
      id: 'latency',
      label: 'Error Rate',
      value: `${m.errorRate}%`,
      trend: m.errorRate > 5 ? 'up' : 'down',
      tone: m.errorRate > 5 ? 'danger' : m.errorRate > 2 ? 'warning' : 'success',
      icon: 'activity',
    },
    {
      id: 'health',
      label: 'Log Volume / min',
      value: String(volNow),
      tone: 'default',
      icon: 'bar-chart-2',
    },
  ];
}
