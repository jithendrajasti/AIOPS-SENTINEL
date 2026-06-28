"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Sparkles,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Users,
  TrendingUp,
  Layers,
  Server,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "@/components/common/status-badge";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { Incident, LogLine } from "@/types";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [similar, setSimilar] = useState<Incident[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);

  // "Mark as Golden Record" modal state
  const [showGRModal, setShowGRModal] = useState(false);
  const [grIssue, setGrIssue] = useState("");
  const [grRemediation, setGrRemediation] = useState("");
  const [grService, setGrService] = useState("");
  const [grTags, setGrTags] = useState("");
  const [grSaving, setGrSaving] = useState(false);
  const [grSaved, setGrSaved] = useState(false);
  const grCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!params.id) return;
    apiFetch<Incident>(`/api/incidents/${params.id}`)
      .then((inc) => {
        setIncident(inc);
        if (inc.recentLogs && inc.recentLogs.length > 0) {
          setLogs(inc.recentLogs);
        }
        return apiFetch<{ incidents: Incident[] }>("/api/incidents");
      })
      .then((d) => setSimilar(d.incidents.filter((i) => i.id !== params.id).slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    return () => {
      if (grCloseTimer.current) clearTimeout(grCloseTimer.current);
    };
  }, []);

  async function updateStatus(status: "resolved" | "dismissed") {
    if (!incident) return;
    try {
      const data = await apiFetch<{ incident: Incident }>(`/api/incidents/${incident.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setIncident(data.incident);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  function openGRModal() {
    if (!incident) return;
    setGrIssue(incident.rootCause ?? "");
    setGrRemediation(incident.suggestedFix ?? "");
    setGrService(incident.service ?? "");
    setGrTags("");
    setGrSaved(false);
    setShowGRModal(true);
  }

  async function saveGoldenRecord() {
    if (!grIssue.trim() || !grRemediation.trim() || !grService.trim()) return;
    setGrSaving(true);
    try {
      const tags = grTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await apiFetch("/api/golden-records", {
        method: "POST",
        body: JSON.stringify({ issue: grIssue, resolution: grRemediation, source: grService, tags }),
      });
      setGrSaved(true);
      grCloseTimer.current = setTimeout(() => setShowGRModal(false), 1200);
    } catch (err) {
      console.error("Failed to create golden record:", err);
    } finally {
      setGrSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        Loading incident…
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">
        Incident not found.
      </div>
    );
  }

  const suggestedSteps = (incident.suggestedFix ?? "")
    .split("\n")
    .filter((s) => s.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/incidents" className="hover:text-foreground">
          Incidents
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{incident.code}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{incident.code}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
            {incident.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
            <span className="text-sm text-muted-foreground">
              {incident.service} · {formatRelativeTime(incident.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {incident.status === "resolved" && (
            <Button variant="outline" size="sm" onClick={openGRModal}>
              <ShieldCheck className="h-4 w-4" />
              Mark as Golden Record
            </Button>
          )}
          {incident.status !== "dismissed" && incident.status !== "resolved" && (
            <Button variant="outline" size="sm" onClick={() => updateStatus("dismissed")}>
              <XCircle className="h-4 w-4" />
              Dismiss
            </Button>
          )}
          {incident.status !== "resolved" && (
            <Button variant="gradient" size="sm" onClick={() => updateStatus("resolved")}>
              <CheckCircle2 className="h-4 w-4" />
              Resolve Incident
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="similar">Similar</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Incident Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    <Info label="Status">
                      <IncidentStatusBadge status={incident.status} />
                    </Info>
                    <Info label="Created At">{formatDateTime(incident.createdAt)}</Info>
                    <Info label="Assigned To">{incident.assignedTo}</Info>
                    <Info label="Environment">{incident.environment}</Info>
                    {incident.resolvedAt && (
                      <Info label="Resolved At">{formatDateTime(incident.resolvedAt)}</Info>
                    )}
                    <Info label="Description" full>
                      {incident.description}
                    </Info>
                  </dl>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/20 to-transparent blur-3xl" />
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sky-400" />
                    AI Root Cause Analysis
                  </CardTitle>
                  <Badge variant="default">Conf. {incident.confidence}%</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{incident.rootCause}</p>

                  {suggestedSteps.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                      <p className="text-sm font-medium text-emerald-400">Suggested fix</p>
                      <ul className="mt-2 space-y-1.5">
                        {suggestedSteps.map((step, i) => (
                          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                            {step.replace(/^\d+\.\s*/, "")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Logs */}
            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  {logs.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[hsl(222_47%_4%)] font-mono text-xs">
                      {logs.map((log, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 border-b border-white/[0.04] px-3 py-2 last:border-0 hover:bg-white/[0.02]"
                        >
                          <span className="shrink-0 text-muted-foreground">
                            {new Date(log.ts).toISOString().slice(11, 19)}
                          </span>
                          <span
                            className={`shrink-0 font-semibold ${
                              log.level === "ERROR"
                                ? "text-rose-400"
                                : log.level === "WARN"
                                ? "text-amber-400"
                                : log.level === "INFO"
                                ? "text-sky-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {log.level}
                          </span>
                          <span className="shrink-0 text-indigo-300">[{log.service}]</span>
                          <span className="text-foreground/90">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No logs attached to this incident.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Similar incidents */}
            <TabsContent value="similar">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Similar Incidents</CardTitle>
                  <Badge variant="secondary">{incident.similarCount} matches</Badge>
                </CardHeader>
                <CardContent className="space-y-1">
                  {similar.map((s) => (
                    <Link
                      key={s.id}
                      href={`/incidents/${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.title}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {s.code} · {s.service}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={s.severity} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                  {similar.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No similar incidents found.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Affected Systems
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {incident.affectedSystems.map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <Server className="h-4 w-4 text-sky-400" />
                  {s}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impact Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Metric icon={Users} label="Impacted users" value={formatNumber(incident.impactedUsers)} />
              <Metric icon={TrendingUp} label="Error rate" value={`${incident.errorRate}%`} />
              <Metric icon={Layers} label="Affected systems" value={String(incident.affectedSystems.length)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mark as Golden Record modal */}
      {showGRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowGRModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[hsl(222_44%_6%)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-400" />
                <h2 className="text-base font-semibold">Save to Golden Records</h2>
              </div>
              <button
                onClick={() => setShowGRModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Issue / Root Cause</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-none"
                  value={grIssue}
                  onChange={(e) => setGrIssue(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Remediation / Fix</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-none"
                  value={grRemediation}
                  onChange={(e) => setGrRemediation(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Service</label>
                  <input
                    className="flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    value={grService}
                    onChange={(e) => setGrService(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
                  <input
                    className="flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    placeholder="e.g. database, connection"
                    value={grTags}
                    onChange={(e) => setGrTags(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowGRModal(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={saveGoldenRecord}
                disabled={grSaving || grSaved || !grIssue.trim() || !grRemediation.trim() || !grService.trim()}
              >
                {grSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved!
                  </>
                ) : grSaving ? (
                  "Saving…"
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Save Golden Record
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
