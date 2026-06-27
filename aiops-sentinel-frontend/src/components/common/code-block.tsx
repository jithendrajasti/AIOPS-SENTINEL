"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  language = "ts",
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-white/[0.06] bg-[hsl(222_47%_4%)]",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {language}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}
