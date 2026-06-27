"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Siren,
  Server,
  ShieldCheck,
  Bot,
  BarChart3,
  Settings,
  ChevronLeft,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { Incident } from "@/types";
import { useSocketData } from "@/context/socket-context";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

const BASE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Incidents", href: "/incidents", icon: Siren },
  { label: "Services", href: "/services", icon: Server },
  { label: "Golden Records", href: "/golden-records", icon: ShieldCheck },
  { label: "AI Assistant", href: "/assistant", icon: Bot },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [dbIncidents, setDbIncidents] = useState<Incident[]>([]);
  const { incidents: liveIncidents } = useSocketData();

  useEffect(() => {
    apiFetch<{ incidents: Incident[] }>("/api/incidents")
      .then((d) => setDbIncidents(d.incidents))
      .catch(() => {});
  }, []);

  const incidents = liveIncidents.length > 0
    ? [...liveIncidents, ...dbIncidents.filter((d) => !liveIncidents.find((l) => l.id === d.id))]
    : dbIncidents;

  const unresolvedCount = incidents.filter(
    (i) => i.status === "open"
  ).length;



  const navItems = BASE_NAV.map((item) => {
    if (item.label === "Incidents") {
      return { ...item, badge: unresolvedCount > 0 ? unresolvedCount : undefined };
    }
    return item;
  });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.06] bg-[hsl(222_44%_6%)]/70 backdrop-blur-xl transition-[width] duration-300 lg:flex",
        collapsed ? "w-[78px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-4">
        {collapsed ? <LogoMark size={36} /> : <Logo />}
        <button
          onClick={onToggle}
          className="hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground lg:flex"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 no-scrollbar">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-sky-400 to-indigo-500 w-[3px]" />
              )}
              <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-sky-400")} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Live stream pill */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl border border-white/[0.06] bg-gradient-to-br from-sky-500/10 to-indigo-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            AI Brain online
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Gemini + Pinecone analyzing live log stream.
          </p>
        </div>
      )}
    </aside>
  );
}
