"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  LayoutDashboard,
  Siren,
  Server,
  ShieldCheck,
  Bot,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { MotionConfig } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Logo } from "@/components/brand/logo";
import { useSettings } from "@/context/settings-context";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard",     href: "/dashboard",      icon: LayoutDashboard },
  { label: "Incidents",     href: "/incidents",      icon: Siren           },
  { label: "Services",      href: "/services",       icon: Server          },
  { label: "Golden Records", href: "/golden-records", icon: ShieldCheck    },
  { label: "AI Assistant",  href: "/assistant",      icon: Bot             },
  { label: "Analytics",     href: "/analytics",      icon: BarChart3       },
  { label: "Settings",      href: "/settings",       icon: Settings        },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname  = usePathname();
  const { reduceMotion } = useSettings();

  return (
    // When reduceMotion is on, MotionConfig tells every framer-motion component
    // in the tree to skip animations entirely.
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <div className="min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-white/[0.06] bg-[hsl(222_44%_6%)] p-4 animate-fade-in">
              <div className="mb-4 flex items-center justify-between">
                <Logo />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.06]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {NAV.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                        active
                          ? "bg-white/[0.07] text-foreground"
                          : "text-muted-foreground hover:bg-white/[0.04]"
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px]", active && "text-sky-400")} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-300",
            collapsed ? "lg:pl-[78px]" : "lg:pl-[260px]"
          )}
        >
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="flex-1 px-4 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1500px] animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
