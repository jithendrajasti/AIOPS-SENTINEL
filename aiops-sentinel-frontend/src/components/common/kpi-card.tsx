"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DynamicIcon } from "@/components/common/icon";
import { cn } from "@/lib/utils";
import type { KPI } from "@/types";

const TONE: Record<
  NonNullable<KPI["tone"]>,
  { icon: string; ring: string; glow: string }
> = {
  default: { icon: "text-sky-400", ring: "bg-sky-500/10", glow: "from-sky-500/10" },
  danger: { icon: "text-rose-400", ring: "bg-rose-500/10", glow: "from-rose-500/10" },
  success: { icon: "text-emerald-400", ring: "bg-emerald-500/10", glow: "from-emerald-500/10" },
  warning: { icon: "text-amber-400", ring: "bg-amber-500/10", glow: "from-amber-500/10" },
};

export function KpiCard({ kpi, index = 0 }: { kpi: KPI; index?: number }) {
  const tone = TONE[kpi.tone ?? "default"];
  const TrendIcon = kpi.trend === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Card className="glass-hover relative overflow-hidden p-5">
        <div
          className={cn(
            "pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl",
            tone.glow
          )}
        />
        <div className="flex items-start justify-between">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tone.ring)}>
            <DynamicIcon name={kpi.icon} className={cn("h-5 w-5", tone.icon)} />
          </div>
          {kpi.delta != null && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                kpi.trend === "down"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {kpi.delta}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">{kpi.label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{kpi.value}</p>
        </div>
      </Card>
    </motion.div>
  );
}
