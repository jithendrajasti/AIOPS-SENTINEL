"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Sparkles, ArrowRight, Send } from "lucide-react";
import { useAuth } from "@/context/auth-context";

const PROMPTS = [
  { label: "Explain the latest critical incident", q: "Explain the latest critical incident in plain English, including root cause and suggested fix." },
  { label: "What caused recent database failures?", q: "What caused the recent database connection failures?" },
  { label: "Show top root causes this week", q: "Show me the top root causes this week" },
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [widgetInput, setWidgetInput] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const firstName = user?.name.split(" ")[0] ?? "there";

  function handleWidgetSend() {
    const q = widgetInput.trim();
    if (!q) return;
    router.push(`/assistant?q=${encodeURIComponent(q)}`);
    setWidgetInput("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105 active:scale-95"
        aria-label="Open AI Assistant"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="glass fixed bottom-24 right-6 z-40 w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-gradient-to-r from-sky-500/10 to-indigo-500/10 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                <Sparkles className="h-4 w-4 text-sky-400" />
              </span>
              <div>
                <p className="text-sm font-semibold">Sentinel AI</p>
                <p className="text-[11px] text-emerald-400">Online · Gemini</p>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="rounded-lg rounded-tl-sm bg-white/[0.04] p-3 text-sm">
                Hi {firstName} 👋 I can explain incidents, surface similar cases, decode
                stack traces, and draft postmortems. What do you need?
              </div>
              <div className="space-y-1.5">
                {PROMPTS.map((p) => (
                  <Link
                    key={p.label}
                    href={`/assistant?q=${encodeURIComponent(p.q)}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-white/10 hover:text-foreground"
                  >
                    {p.label}
                    <ArrowRight className="h-3 w-3 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-white/[0.06] p-3">
              <div className="relative">
                <input
                  className="flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 pr-10 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  placeholder="Ask Sentinel AI…"
                  value={widgetInput}
                  onChange={(e) => setWidgetInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleWidgetSend()}
                />
                <button
                  onClick={handleWidgetSend}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                  disabled={!widgetInput.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
