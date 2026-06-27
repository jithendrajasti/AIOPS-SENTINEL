"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Sparkles,
  MoreHorizontal,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/common/kpi-card";
import { ServiceStatusBadge } from "@/components/common/status-badge";
import { AreaTrend } from "@/components/charts/charts";
import { AssistantWidget } from "@/components/dashboard/assistant-widget";
import { formatRelativeTime } from "@/lib/utils";
import { useSocketData } from "@/context/socket-context";
import { apiFetch } from "@/lib/api";
import type { Incident, Service, Endpoint } from "@/types";

export default function DashboardPage() {
  const { incidents: liveIncidents, kpis, timeline } = useSocketData();
  const [dbIncidents, setDbIncidents]  = useState<Incident[]>([]);
  const [services, setServices]        = useState<Service[]>([]);
  const [topEndpoints, setEndpoints]   = useState<Endpoint[]>([]);
  const [payloadSize, setVolume]       = useState<{ x: string; size: number }[]>([]);

  useEffect(() => {
    apiFetch<{ incidents: Incident[] }>("/api/incidents")
      .then((d) => {
        setDbIncidents(d.incidents);
      })
      .catch(() => {});

    apiFetch<{ services: Service[] }>("/api/services")
      .then((d) => setServices(d.services))
      .catch(() => {});

    apiFetch<{
      analyticsKpis: unknown;
      summary: { endpoints: Endpoint[]; volume: { x: string; size: number }[] };
    }>("/api/analytics")
      .then((d) => {
        setEndpoints(d.summary.endpoints);
        setVolume(d.summary.volume);
      })
      .catch(() => {});
  }, []);

  // Merge socket live incidents with DB incidents (live ones take precedence)
  const incidents = liveIncidents.length > 0
    ? [...liveIncidents, ...dbIncidents.filter((d) => !liveIncidents.find((l) => l.id === d.id))]
    : dbIncidents;

  const latestRca = incidents.find((i) => i.severity === "critical" && i.status !== "resolved" && i.status !== "dismissed") ?? incidents[0] ?? null;

  const topServices = services.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time health across the AI-Ops Sentinel pipeline.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · AI-Ops Sentinel
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Incident feed */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Incident Feed</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/incidents">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {incidents.slice(0, 4).map((inc, i) => (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/incidents/${inc.id}`}
                  className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      inc.severity === "critical"
                        ? "bg-rose-500/15 text-rose-400"
                        : inc.severity === "high"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-sky-500/15 text-sky-400"
                    }`}
                  >
                    <AlertCircle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium group-hover:text-foreground">
                        {inc.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(inc.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {inc.description}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {inc.service}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </motion.div>
            ))}
            {incidents.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No incidents yet. System is healthy.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right column: AI root cause + services health */}
        <div className="space-y-4">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/20 to-transparent blur-3xl" />
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                AI Root Cause Analysis
              </CardTitle>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {latestRca ? (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{latestRca.rootCause}</p>
                    <Badge variant="default">{latestRca.confidence}% conf.</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {latestRca.description}
                  </p>
                  <Button asChild variant="link" className="mt-1 h-auto p-0 text-sky-400">
                    <Link href={`/incidents/${latestRca.id}`}>
                      Open incident
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-sm text-muted-foreground">
                    No active incidents requiring AI analysis. System appears healthy.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Services Health</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/services">All services</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {topServices.map((svc) => (
                <Link
                  key={svc.id}
                  href={`/services/${svc.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-sm font-medium">{svc.name}</span>
                  <div className="flex items-center gap-3">
                    <ServiceStatusBadge status={svc.status} />
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                      {svc.uptime.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              ))}
              {topServices.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No services registered yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Latest Incidents (Today)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.slice(0, 5).map((e, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-400 ring-4 ring-sky-500/10" />
                  {i < 4 && <span className="mt-1 w-px flex-1 bg-white/[0.08]" />}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{e.ts}</p>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No live events yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Affected Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Endpoint</span>
              <span className="text-right">Affected</span>
              <span className="text-right">Payload</span>
            </div>
            <div className="mt-2 space-y-1">
              {topEndpoints.map((ep) => (
                <div
                  key={ep.endpoint}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-md px-1 py-2 text-sm transition-colors hover:bg-white/[0.03]"
                >
                  <span className="truncate font-mono text-xs">{ep.endpoint}</span>
                  <span className="text-right tabular-nums">{ep.affected}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {ep.payload}
                  </span>
                </div>
              ))}
              {topEndpoints.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payload Size</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaTrend data={payloadSize} dataKey="size" xKey="x" height={200} color="#38bdf8" />
          </CardContent>
        </Card>
      </div>

      <AssistantWidget />
    </div>
  );
}
