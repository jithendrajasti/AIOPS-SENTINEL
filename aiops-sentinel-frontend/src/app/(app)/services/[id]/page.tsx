"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Activity, TrendingUp, Gauge, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ServiceStatusBadge, SeverityBadge } from "@/components/common/status-badge";
import { DynamicIcon } from "@/components/common/icon";
import { AreaTrend } from "@/components/charts/charts";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Service, Incident } from "@/types";

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [deps, setDeps] = useState<Service[]>([]);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      apiFetch<{ service: Service; recentIncidents: Incident[] }>(`/api/services/${params.id}`),
      apiFetch<{ services: Service[] }>("/api/services"),
    ])
      .then(([{ service: svc, recentIncidents }, allSvcs]) => {
        setService(svc);
        setDeps(svc.dependencies.map((d) => allSvcs.services.find((s) => s.id === d)).filter(Boolean) as Service[]);
        setRecent(recentIncidents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        Loading service…
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        Service not found.
      </div>
    );
  }

  const trend = service.sparkline.map((v, i) => ({ x: i, latency: v }));

  const metrics = [
    { label: "Availability", value: `${service.uptime.toFixed(2)}%`, icon: Activity, pct: service.uptime, tone: "from-emerald-500 to-teal-500" },
    { label: "Error Rate", value: `${service.errorRate.toFixed(2)}%`, icon: TrendingUp, pct: Math.min(service.errorRate * 10, 100), tone: "from-rose-500 to-orange-500" },
    { label: "Latency", value: `${service.latency} ms`, icon: Gauge, pct: Math.min(service.latency / 40, 100), tone: "from-sky-500 to-indigo-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/services" className="hover:text-foreground">
          Services
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{service.name}</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
            <DynamicIcon name={service.icon} className="h-6 w-6 text-sky-400" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
            <p className="text-sm text-muted-foreground">
              {service.incidents} active incidents · {service.dependencies.length} dependencies
            </p>
          </div>
        </div>
        <ServiceStatusBadge status={service.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{m.value}</p>
              <Progress
                value={m.pct}
                className="mt-3"
                indicatorClassName={cn("bg-gradient-to-r", m.tone)}
              />
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Health Trends — Latency (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaTrend data={trend} dataKey="latency" xKey="x" color="#38bdf8" height={260} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              Dependency Graph
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2">
                <DynamicIcon name={service.icon} className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-medium">{service.name}</span>
                <Badge variant="secondary" className="ml-auto">root</Badge>
              </div>
              {deps.length > 0 ? (
                <div className="ml-3 space-y-2 border-l border-white/[0.08] pl-4">
                  {deps.map((d) => (
                    <Link
                      key={d.id}
                      href={`/services/${d.id}`}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors hover:bg-white/[0.05]"
                    >
                      <DynamicIcon name={d.icon} className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{d.name}</span>
                      <span className="ml-auto">
                        <ServiceStatusBadge status={d.status} />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upstream dependencies.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent.length > 0 ? (
            recent.map((inc) => (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="flex items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inc.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{inc.code}</p>
                </div>
                <SeverityBadge severity={inc.severity} />
              </Link>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No incidents recorded for this service.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
