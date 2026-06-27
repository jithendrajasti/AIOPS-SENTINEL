"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Bot, User, FileText, GitCompare, Bug, ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/types";

const CAPABILITIES = [
  { icon: FileText,    label: "Explain latest incident",    prompt: "Explain the latest critical incident in plain English, including root cause and suggested fix." },
  { icon: GitCompare,  label: "Find similar incidents",     prompt: "Show incidents similar to recent database connection failures and suggest patterns to watch." },
  { icon: Bug,         label: "Decode a stack trace",       prompt: "Explain how to diagnose a PoolExhaustedError stack trace and identify the root cause." },
  { icon: ScrollText,  label: "Generate postmortem",        prompt: "Generate a postmortem report for the most recent critical incident in the system." },
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function AssistantPage() {
  const { user } = useAuth();
  const firstName = user?.name.split(" ")[0] ?? "there";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${firstName} 👋 I'm Sentinel AI, powered by Gemini + Pinecone. I can explain incidents, find similar cases, decode stack traces, and generate postmortems. Ask me anything or pick a prompt below.`,
      ts: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const didAutoSend = useRef(false);

  // Auto-send ?q= URL param (from widget or topbar)
  useEffect(() => {
    if (didAutoSend.current) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q?.trim()) {
      didAutoSend.current = true;
      window.history.replaceState({}, "", "/assistant");
      // Small delay so welcome message renders first
      setTimeout(() => send(q.trim()), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update greeting when user loads
  useEffect(() => {
    if (!user) return;
    const name = user.name.split(" ")[0];
    setMessages((m) =>
      m.map((msg) =>
        msg.id === "welcome"
          ? { ...msg, content: `Hi ${name} 👋 I'm Sentinel AI, powered by Gemini + Pinecone. I can explain incidents, find similar cases, decode stack traces, and generate postmortems. Ask me anything or pick a prompt below.` }
          : msg
      )
    );
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || typing) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content, ts: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    const assistantId = uid();

    try {
      const data = await apiFetch<{ reply: string }>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message: content }),
      });

      setTyping(false);

      // Stream the reply word-by-word for a smooth UX
      const words = data.reply.split(" ");
      setMessages((m) => [
        ...m,
        { id: assistantId, role: "assistant", content: "", ts: new Date().toISOString(), streaming: true },
      ]);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: words.slice(0, i).join(" ") }
              : msg
          )
        );
        if (i >= words.length) {
          clearInterval(interval);
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, streaming: false } : msg))
          );
        }
      }, 22);
    } catch (err) {
      setTyping(false);
      const errorMsg = err instanceof Error ? err.message : "Failed to get a response. Please try again.";
      setMessages((m) => [
        ...m,
        {
          id: assistantId,
          role: "assistant",
          content: `Sorry, I encountered an error: ${errorMsg}`,
          ts: new Date().toISOString(),
        },
      ]);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 ring-1 ring-white/10">
          <Sparkles className="h-5 w-5 text-sky-400" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sentinel AI Assistant</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Online · Gemini + Pinecone
          </p>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-sky-500/30 to-indigo-500/30"
                    : "bg-white/[0.06]"
                )}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4 text-sky-400" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </span>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? "rounded-tl-sm border border-white/[0.06] bg-white/[0.03]"
                    : "rounded-tr-sm bg-gradient-to-br from-sky-500 to-indigo-600 text-white"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-p:leading-relaxed prose-headings:font-semibold">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
                {msg.streaming && (
                  <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-sky-400" />
                )}
              </div>
            </motion.div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/30 to-indigo-500/30">
                <Bot className="h-4 w-4 text-sky-400" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </CardContent>

        {/* Suggested prompts */}
        {messages.length <= 1 && (
          <div className="border-t border-white/[0.06] p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Capabilities
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CAPABILITIES.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.label}
                    onClick={() => send(c.prompt)}
                    className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-sm transition-colors hover:border-white/10 hover:bg-white/[0.05]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-sky-400" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-white/[0.06] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Sentinel AI about an incident, service, or stack trace…"
                className="flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </div>
            <Button type="submit" variant="gradient" size="icon" className="h-11 w-11 rounded-xl" disabled={typing || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Sentinel AI can make mistakes. Verify critical remediations before applying.
          </p>
        </div>
      </Card>
    </div>
  );
}
