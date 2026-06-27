"use client";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AXIS = { fontSize: 11, fill: "hsl(215 20% 60%)" };
const GRID = "hsl(217 33% 16% / 0.6)";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function AreaTrend({
  data,
  dataKey,
  xKey = "date",
  color = "#38bdf8",
  height = 240,
}: {
  data: any[];
  dataKey: string;
  xKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#area-${dataKey})`}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({
  data,
  dataKey,
  xKey = "date",
  color = "#a78bfa",
  height = 240,
}: {
  data: any[];
  dataKey: string;
  xKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.25}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarTrend({
  data,
  dataKey,
  xKey = "name",
  height = 240,
}: {
  data: any[];
  dataKey: string;
  xKey?: string;
  height?: number;
}) {
  const palette = ["#38bdf8", "#34d399", "#a78bfa", "#fbbf24", "#f472b6"];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(217 33% 16% / 0.4)" }} />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} maxBarSize={42}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 240,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip content={<ChartTooltip />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={3}
          stroke="none"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
