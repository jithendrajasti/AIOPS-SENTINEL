"use client";

import { Radio } from "lucide-react";
import { useLiveStream } from "@/hooks/use-live-data";
import { cn } from "@/lib/utils";

export function LiveStreamBadge() {
  const { connected, eventsPerSec } = useLiveStream();

  return (
    <div className="hidden items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 sm:flex">
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        <span
          className={cn(
            "absolute h-2.5 w-2.5 rounded-full",
            connected ? "bg-emerald-500/70 animate-pulse-ring" : "bg-muted-foreground"
          )}
        />
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            connected ? "bg-emerald-400" : "bg-muted-foreground"
          )}
        />
      </span>
      <Radio className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-xs font-medium">
        Live <span className="tabular-nums text-muted-foreground">· {eventsPerSec}/s</span>
      </span>
    </div>
  );
}
