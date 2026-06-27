import { io, type Socket } from "socket.io-client";

/**
 * Socket.IO client singleton.
 *
 * The frontend is backend-agnostic: point NEXT_PUBLIC_SOCKET_URL at the
 * AI-Ops Sentinel realtime gateway when available. Until then the app uses the
 * simulated stream in `useLiveData`, so a missing server never breaks the UI
 * (autoConnect is disabled).
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket"],
      reconnectionAttempts: 3,
      timeout: 4000,
    });
  }
  return socket;
}

export const SOCKET_EVENTS = {
  INCIDENT_NEW: "incident:new",
  INCIDENT_UPDATE: "incident:update",
  SERVICE_HEALTH: "service:health",
  KPI_UPDATE: "kpi:update",
  TIMELINE: "timeline:event",
} as const;
