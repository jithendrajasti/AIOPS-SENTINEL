"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { AreaTrend, LineTrend, BarTrend, DonutChart } from "@/components/charts/charts";
import { apiFetch } from "@/lib/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { KPI } from "@/types";

interface GoldenRecordUsage {
  totalRecords: number;
  totalApplications: number;
  reuseRate: number;
  topRecord: { issue: string; hitCount: number } | null;
}

interface AnalyticsData {
  analyticsKpis: KPI[];
  incidentsOverTime: { x: string; incidents: number }[];
  incidentsByService: { name: string; value: number; color: string }[];
  topRootCauses: { name: string; value: number }[];
  mttrOverTime: { x: string; mttr: number }[];
  goldenRecordUsage: GoldenRecordUsage;
}

const EMPTY: AnalyticsData = {
  analyticsKpis: [],
  incidentsOverTime: [],
  incidentsByService: [],
  topRootCauses: [],
  mttrOverTime: [],
  goldenRecordUsage: {
    totalRecords: 0,
    totalApplications: 0,
    reuseRate: 0,
    topRecord: null,
  },
};

const RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "30d", label: "Last 30 days" },
  { value: "1y", label: "Last 1 year" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    apiFetch<AnalyticsData>(`/api/analytics?range=${range}`)
      .then((d) => setData(d))
      .catch(() => {});
  }, [range]);

  const { goldenRecordUsage: gr } = data;

  const usageStats = [
    { label: "Total Records", value: String(gr.totalRecords), sub: "in knowledge base" },
    { label: "Total Applications", value: String(gr.totalApplications), sub: "times applied" },
    { label: "Reuse Rate", value: `${gr.reuseRate}%`, sub: "records used more than once" },
    { label: "Most Used Record", value: gr.topRecord ? `${gr.topRecord.hitCount}x` : "—", sub: gr.topRecord ? gr.topRecord.issue.slice(0, 28) + "…" : "No records yet" },
  ];

  const currentRangeLabel = RANGES.find(r => r.value === range)?.label || "Last 30 days";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        subtitle="Trends across incidents, resolution time, and the golden-records knowledge base."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays className="h-4 w-4 mr-2" />
                {currentRangeLabel}
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {RANGES.map(r => (
                <DropdownMenuItem key={r.value} onClick={() => setRange(r.value)}>
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.analyticsKpis.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidents Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaTrend data={data.incidentsOverTime} dataKey="incidents" color="#38bdf8" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidents by Service</CardTitle>
          </CardHeader>
          <CardContent>
            {data.incidentsByService.length > 0 ? (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="w-full max-w-[220px]">
                  <DonutChart data={data.incidentsByService} height={220} />
                </div>
                <div className="flex-1 space-y-2">
                  {data.incidentsByService.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="font-medium tabular-nums">{s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Root Causes (by Severity)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarTrend data={data.topRootCauses} dataKey="value" xKey="name" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MTTR Over Time (minutes)</CardTitle>
          </CardHeader>
          <CardContent>
            <LineTrend data={data.mttrOverTime} dataKey="mttr" color="#a78bfa" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Golden Record Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {usageStats.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-semibold">{s.value}</p>
                <p className="mt-0.5 text-xs text-emerald-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
