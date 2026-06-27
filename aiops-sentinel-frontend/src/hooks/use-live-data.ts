"use client";

import { useEffect, useState } from "react";

/**
 * Simulated real-time feed. In production this would subscribe to the
 * Socket.IO events in `services/socket.ts`; here it drives the live UI with
 * deterministic-ish mock updates so the dashboard feels alive offline.
 */
export function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useLiveStream(active = true) {
  const [connected, setConnected] = useState(false);
  const [eventsPerSec, setEventsPerSec] = useState(0);

  useEffect(() => {
    if (!active) return;
    setConnected(true);
    const id = setInterval(() => {
      setEventsPerSec(Math.round(18 + Math.random() * 40));
    }, 1500);
    return () => {
      clearInterval(id);
      setConnected(false);
    };
  }, [active]);

  return { connected, eventsPerSec };
}

/** Smoothly animates a numeric KPI to simulate live updates. */
export function useLiveValue(base: number, jitter = 0.04, intervalMs = 2500) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      const delta = base * jitter * (Math.random() - 0.5) * 2;
      setValue(Math.max(0, base + delta));
    }, intervalMs);
    return () => clearInterval(id);
  }, [base, jitter, intervalMs]);
  return value;
}
