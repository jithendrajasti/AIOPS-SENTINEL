"use client";

import { useEffect, useState } from "react";
import {
  User,
  Bell,
  Plug,
  Palette,
  Check,
  Database,
  Brain,
  GitBranch,
  CheckCircle2,
  Copy,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/context/auth-context";
import { useSettings } from "@/context/settings-context";
import { apiFetch } from "@/lib/api";
import type { Settings } from "@/context/settings-context";

// Uncontrolled toggle — persists only to localStorage (used for notification prefs).
function LocalRow({
  title,
  desc,
  storageKey,
  defaultChecked = false,
}: {
  title: string;
  desc: string;
  storageKey: string;
  defaultChecked?: boolean;
}) {
  const [on, setOn] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return stored === "true";
    }
    return defaultChecked;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(on));
  }, [on, storageKey]);

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

// Controlled toggle — reads from and writes to the global SettingsContext.
function SettingRow({
  title,
  desc,
  settingKey,
}: {
  title: string;
  desc: string;
  settingKey: keyof Settings;
}) {
  const settings = useSettings();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch
        checked={settings[settingKey] as boolean}
        onCheckedChange={(v) => settings.setSetting(settingKey, v)}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const initials = user?.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  const [name, setName]         = useState("");
  const [role, setRole]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied]     = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
    }
  }, [user]);

  async function handleSave() {
    if (!name.trim() || !role.trim()) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), role: role.trim() }),
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const integrations = [
    { name: "Kafka",      desc: "Log ingestion stream",       icon: GitBranch, status: "Connected" },
    { name: "Gemini API", desc: "AI root cause analysis",     icon: Brain,     status: "Connected" },
    { name: "Pinecone",   desc: "Vector similarity search",   icon: Database,  status: "Connected" },
  ];

  const handleCopy = () => {
    if (user?.platformId) {
      navigator.clipboard.writeText(user.platformId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const installCommand = `PLATFORM_ID="${user?.platformId ?? 'your-platform-id'}" LOG_FILE_PATH="/path/to/app.log" KAFKA_BROKERS="api.aiops-sentinel.com:9092" npx aiops-log-collector`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(installCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your profile, notifications, and platform integrations." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-1 ring-white/10">
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user?.name ?? ""}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={user?.email ?? ""} disabled className="opacity-60" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Platform ID (Workspace)</label>
                  <div className="flex gap-2">
                    <Input value={user?.platformId ?? ""} disabled className="opacity-60 font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Use this ID in your log-collector agent&apos;s .env file (PLATFORM_ID) to stream logs to your isolated workspace.
                  </p>
                </div>
              </div>
              {saveError && <p className="text-xs text-rose-400">{saveError}</p>}
              <div className="flex items-center justify-end gap-3">
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Changes saved
                  </span>
                )}
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !role.trim()}
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications — local localStorage only, no global effect needed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/[0.04]">
              <LocalRow title="Critical incidents"   desc="Get paged immediately for P1 incidents."              storageKey="notif_critical" defaultChecked />
              <LocalRow title="AI root cause ready"  desc="Notify when Sentinel AI completes an analysis."       storageKey="notif_ai"       defaultChecked />
              <LocalRow title="Service degradation"  desc="Alert when a service drops below SLO."               storageKey="notif_service"  defaultChecked />
              <LocalRow title="Weekly digest"         desc="A Monday summary of incidents and MTTR."             storageKey="notif_weekly" />
            </CardContent>
          </Card>

          {/* Real-time & Appearance — wired to global SettingsContext */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Real-time & Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/[0.04]">
              <SettingRow
                title="Live log stream"
                desc="Stream incidents and health over Socket.IO. Toggle off to disconnect."
                settingKey="liveStream"
              />
              <SettingRow
                title="Animated charts"
                desc="Enable entrance animations on dashboards and charts."
                settingKey="animatedCharts"
              />
              <SettingRow
                title="Reduce motion"
                desc="Minimize all non-essential animations across the dashboard."
                settingKey="reduceMotion"
              />
            </CardContent>
          </Card>
        </div>

        {/* Integrations */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-muted-foreground" />
                Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrations.map((it) => {
                const Icon = it.icon;
                return (
                  <div
                    key={it.name}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                      <Icon className="h-4 w-4 text-sky-400" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{it.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.desc}</p>
                    </div>
                    <Badge variant="success">
                      <Check className="h-3 w-3" />
                      {it.status}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Installation */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Installation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Run this command on your servers to install and run the log collector agent instantly using NPX. 
                It will stream your logs directly into your isolated workspace.
              </p>
              <div className="flex items-center gap-4 rounded-md bg-black/40 p-4 text-xs font-mono text-emerald-400 overflow-x-auto border border-white/[0.06]">
                <span className="whitespace-nowrap flex-1 overflow-x-auto custom-scrollbar pb-1">{installCommand}</span>
                <Button variant="outline" size="icon" onClick={handleCopyCommand} className="shrink-0 bg-white/5 border-white/10 hover:bg-white/10 h-8 w-8">
                  {copiedCommand ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
