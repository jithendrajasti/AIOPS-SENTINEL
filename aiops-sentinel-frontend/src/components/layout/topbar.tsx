"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Menu, ChevronDown, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LiveStreamBadge } from "@/components/layout/live-stream-badge";
import { useAuth } from "@/context/auth-context";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const initials = user?.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchValue.trim()) {
      router.push(`/incidents?q=${encodeURIComponent(searchValue.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-background/70 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search incidents, services, logs…"
          className="h-10 pl-9 pr-16"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleSearchKey}
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
          ↵
        </kbd>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none ml-auto">
        <LiveStreamBadge />
        
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground">
              <Bell className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="py-6 text-center text-xs text-muted-foreground">
              No new notifications
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 pl-1 pr-2 transition-colors hover:bg-white/[0.06]">
              <Avatar className="h-8 w-8 ring-1 ring-white/10">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{user?.name ?? ""}</span>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{user?.name ?? ""}</span>
                <span className="text-xs text-muted-foreground">{user?.email ?? ""}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-400" onClick={logout}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
