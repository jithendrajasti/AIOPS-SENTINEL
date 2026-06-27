"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSocket, SOCKET_EVENTS } from "@/services/socket";
import { useAuth } from "@/context/auth-context";
import { useSettings } from "@/context/settings-context";
import type { Incident, KPI, TimelineEvent } from "@/types";

const EMPTY_KPIS: KPI[] = [
  { id: "critical", label: "Critical Incidents", value: "0",  tone: "default", icon: "alert-triangle" },
  { id: "logs",     label: "Logs Processed",     value: "0",  tone: "default", icon: "scroll-text"    },
  { id: "latency",  label: "Error Rate",          value: "0%", tone: "default", icon: "activity"       },
  { id: "health",   label: "Log Volume / min",    value: "0",  tone: "default", icon: "bar-chart-2"    },
];

interface SocketContextValue {
  incidents: Incident[];
  kpis: KPI[];
  timeline: TimelineEvent[];
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token }      = useAuth();
  const { liveStream } = useSettings();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [kpis,      setKpis]      = useState<KPI[]>(EMPTY_KPIS);
  const [timeline,  setTimeline]  = useState<TimelineEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!liveStream || !token) {
      setConnected(false);
      return;
    }

    const socket = getSocket();
    (socket as { auth: Record<string, string> }).auth = { token };
    socket.connect();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setConnected(false);

    const onIncidentNew = (incident: Incident) => {
      setIncidents((prev) => [incident, ...prev].slice(0, 50));
    };

    const onIncidentUpdate = (incident: Incident) => {
      setIncidents((prev) => {
        const idx = prev.findIndex(i => i.id === incident.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = incident;
          return next;
        }
        return [incident, ...prev].slice(0, 50);
      });
    };

    const onKpiUpdate = (data: KPI[]) => {
      setKpis(data);
    };

    const onTimeline = (event: TimelineEvent) => {
      setTimeline((prev) => [event, ...prev].slice(0, 20));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on(SOCKET_EVENTS.INCIDENT_NEW, onIncidentNew);
    socket.on(SOCKET_EVENTS.INCIDENT_UPDATE, onIncidentUpdate);
    socket.on(SOCKET_EVENTS.KPI_UPDATE, onKpiUpdate);
    socket.on(SOCKET_EVENTS.TIMELINE, onTimeline);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off(SOCKET_EVENTS.INCIDENT_NEW, onIncidentNew);
      socket.off(SOCKET_EVENTS.INCIDENT_UPDATE, onIncidentUpdate);
      socket.off(SOCKET_EVENTS.KPI_UPDATE, onKpiUpdate);
      socket.off(SOCKET_EVENTS.TIMELINE, onTimeline);
    };
  }, [liveStream, token]);

  return (
    <SocketContext.Provider value={{ incidents, kpis, timeline, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketData() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocketData must be used within a SocketProvider");
  }
  return ctx;
}
