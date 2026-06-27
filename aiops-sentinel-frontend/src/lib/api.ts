import { getSession } from "next-auth/react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const session = await getSession();
  return session?.accessToken ?? null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    let errorMsg = "Request failed";
    if (body && typeof body === "object") {
      errorMsg = (body as any).error ?? (body as any).message ?? "Request failed";
    } else if (typeof body === "string") {
      errorMsg = body;
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}
