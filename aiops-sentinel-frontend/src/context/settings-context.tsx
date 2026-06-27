"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface Settings {
  liveStream:     boolean;
  animatedCharts: boolean;
  reduceMotion:   boolean;
}

interface SettingsContextValue extends Settings {
  setSetting: (key: keyof Settings, value: boolean) => void;
}

const DEFAULTS: Settings = {
  liveStream:     true,
  animatedCharts: true,
  reduceMotion:   false,
};

const STORAGE_KEYS: Record<keyof Settings, string> = {
  liveStream:     "rt_livestream",
  animatedCharts: "rt_animated",
  reduceMotion:   "rt_reducemotion",
};

function readFromStorage(): Settings {
  return {
    liveStream:     (localStorage.getItem("rt_livestream")   ?? "true")  === "true",
    animatedCharts: (localStorage.getItem("rt_animated")     ?? "true")  === "true",
    reduceMotion:   (localStorage.getItem("rt_reducemotion") ?? "false") === "true",
  };
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start with DEFAULTS so SSR and client first-render agree (no hydration mismatch).
  // After mount, overwrite from localStorage — runs client-only.
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(readFromStorage());
  }, []);

  const setSetting = useCallback((key: keyof Settings, value: boolean) => {
    localStorage.setItem(STORAGE_KEYS[key], String(value));
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, setSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}
