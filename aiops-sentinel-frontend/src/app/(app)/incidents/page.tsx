"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, AlertCircle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "@/components/common/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Incident } from "@/types";
import { useSocketData } from "@/context/socket-context";

export default function IncidentsPage() {
  const { incidents: liveIncidents } = useSocketData();
  const [dbIncidents, setDbIncidents] = useState<Incident[]>([]);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    apiFetch<{ incidents: Incident[] }>("/api/incidents")
      .then((d) => setDbIncidents(d.incidents))
      .catch(() => {});
  }, []);

  const incidents = useMemo(() => {
    return liveIncidents.length > 0
      ? [...liveIncidents, ...dbIncidents.filter((d) => !liveIncidents.find((l) => l.id === d.id))]
      : dbIncidents;
  }, [liveIncidents, dbIncidents]);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesQuery =
        !query ||
        inc.title.toLowerCase().includes(query.toLowerCase()) ||
        inc.code.toLowerCase().includes(query.toLowerCase()) ||
        inc.service.toLowerCase().includes(query.toLowerCase());
      const matchesSeverity = severity === "all" || inc.severity === severity;
      const matchesStatus = status === "all" || inc.status === status;
      return matchesQuery && matchesSeverity && matchesStatus;
    });
  }, [incidents, query, severity, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        subtitle={`${filtered.length} incidents · ${incidents.filter((i) => i.status === "open").length} open`}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search incidents by title, code, or service…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[2.5rem_1fr_10rem_8rem_8rem_8rem_2rem] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span />
            <span>Incident</span>
            <span>Service</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Opened</span>
            <span />
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filtered.map((inc) => (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="group grid grid-cols-1 items-center gap-2 px-4 py-3 transition-colors hover:bg-white/[0.03] md:grid-cols-[2.5rem_1fr_10rem_8rem_8rem_8rem_2rem] md:gap-3"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    inc.severity === "critical"
                      ? "bg-rose-500/15 text-rose-400"
                      : inc.severity === "high"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-sky-500/15 text-sky-400"
                  }`}
                >
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inc.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{inc.code}</p>
                </div>
                <span className="text-sm text-muted-foreground">{inc.service}</span>
                <SeverityBadge severity={inc.severity} />
                <IncidentStatusBadge status={inc.status} />
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(inc.createdAt)}
                </span>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" />
              </Link>
            ))}

            {filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No incidents match your filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
