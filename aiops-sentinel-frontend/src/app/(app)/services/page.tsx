"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Server,
  HeartPulse,
  AlertTriangle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { ServiceStatusBadge } from "@/components/common/status-badge";
import { Sparkline } from "@/components/common/sparkline";
import { DynamicIcon } from "@/components/common/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Service } from "@/types";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    apiFetch<{ services: Service[] }>("/api/services")
      .then((d) => setServices(d.services))
      .catch(() => {});
  }, []);

  const summary = useMemo(
    () => ({
      total: services.length,
      healthy: services.filter((s) => s.status === "healthy").length,
      degraded: services.filter((s) => s.status === "degraded").length,
      down: services.filter((s) => s.status === "down" || s.status === "unhealthy").length,
    }),
    [services]
  );

  const filtered = useMemo(
    () =>
      services.filter((s) => {
        const q = !query || s.name.toLowerCase().includes(query.toLowerCase());
        const st = status === "all" || s.status === status;
        return q && st;
      }),
    [services, query, status]
  );

  const cards = [
    { label: "Total Services", value: summary.total, icon: Server, tone: "text-sky-400", bg: "bg-sky-500/10" },
    { label: "Healthy", value: summary.healthy, icon: HeartPulse, tone: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Degraded", value: summary.degraded, icon: AlertTriangle, tone: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Down", value: summary.down, icon: XCircle, tone: "text-rose-400", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Services Overview" subtitle="Health, uptime and latency across all monitored services." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-hover p-5">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", c.bg)}>
                    <Icon className={cn("h-5 w-5", c.tone)} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="down">Down</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1.4fr_2rem] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Service</span>
            <span>Status</span>
            <span className="text-right">Uptime (%)</span>
            <span className="text-right">Error Rate (%)</span>
            <span>Latency</span>
            <span />
          </div>
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((svc) => (
              <Link
                key={svc.id}
                href={`/services/${svc.id}`}
                className="group grid grid-cols-2 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] md:grid-cols-[1.6fr_1fr_1fr_1fr_1.4fr_2rem]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                    <DynamicIcon name={svc.icon} className="h-4 w-4 text-sky-400" />
                  </span>
                  <span className="text-sm font-medium">{svc.name}</span>
                </div>
                <div>
                  <ServiceStatusBadge status={svc.status} />
                </div>
                <span className="text-right text-sm tabular-nums">{svc.uptime.toFixed(1)}</span>
                <span className="text-right text-sm tabular-nums text-muted-foreground">
                  {svc.errorRate.toFixed(1)}
                </span>
                <div className="flex items-center gap-2">
                  <Sparkline
                    data={svc.sparkline}
                    color={
                      svc.status === "down" || svc.status === "unhealthy"
                        ? "#fb7185"
                        : svc.status === "degraded"
                        ? "#fbbf24"
                        : "#34d399"
                    }
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {svc.latency} ms
                  </span>
                </div>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" />
              </Link>
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No services match your filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
