"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter, Star, ChevronDown, ArrowUpDown, X, CheckCircle2, ClipboardCopy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { GoldenRecord } from "@/types";

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}

export default function GoldenRecordsPage() {
  const [goldenRecords, setGoldenRecords] = useState<GoldenRecord[]>([]);
  const [query, setQuery] = useState("");
  const [service, setService] = useState("all");
  const [sort, setSort] = useState<"recent" | "stars">("recent");

  // New Record modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newIssue, setNewIssue] = useState("");
  const [newRemediation, setNewRemediation] = useState("");
  const [newService, setNewService] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newSaving, setNewSaving] = useState(false);

  // View Detail modal
  const [detailRecord, setDetailRecord] = useState<GoldenRecord | null>(null);

  // Per-row copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ records: GoldenRecord[] }>("/api/golden-records")
      .then((d) => setGoldenRecords(d.records))
      .catch(() => {});
  }, []);

  const serviceOptions = useMemo(
    () => ["all", ...Array.from(new Set(goldenRecords.map((g) => g.service)))],
    [goldenRecords]
  );

  const rows = useMemo(() => {
    let r = goldenRecords.filter((g) => {
      const q =
        !query ||
        g.title.toLowerCase().includes(query.toLowerCase()) ||
        g.issue.toLowerCase().includes(query.toLowerCase()) ||
        g.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()));
      const s = service === "all" || g.service === service;
      return q && s;
    });
    r = [...r].sort((a, b) =>
      sort === "stars" ? b.stars - a.stars : +new Date(b.date) - +new Date(a.date)
    );
    return r;
  }, [goldenRecords, query, service, sort]);

  function openNewModal() {
    setNewIssue("");
    setNewRemediation("");
    setNewService("");
    setNewTags("");
    setShowNewModal(true);
  }

  async function saveNewRecord() {
    if (!newIssue.trim() || !newRemediation.trim() || !newService.trim()) return;
    setNewSaving(true);
    try {
      const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
      const { record } = await apiFetch<{ record: GoldenRecord }>("/api/golden-records", {
        method: "POST",
        body: JSON.stringify({ issue: newIssue, resolution: newRemediation, source: newService, tags }),
      });
      setGoldenRecords((prev) => [record, ...prev]);
      setShowNewModal(false);
    } catch (err) {
      console.error("Failed to create golden record:", err);
    } finally {
      setNewSaving(false);
    }
  }

  async function archiveRecord(id: string) {
    try {
      await apiFetch(`/api/golden-records/${id}`, { method: "DELETE" });
      setGoldenRecords((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error("Failed to archive record:", err);
    }
  }

  function copyRemediation(g: GoldenRecord) {
    navigator.clipboard.writeText(g.remediation).then(() => {
      setCopiedId(g.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Golden Records"
        subtitle="Curated, AI-validated remediations from past incidents."
        actions={
          <Button variant="gradient" size="sm" onClick={openNewModal}>
            <Star className="h-4 w-4" />
            New Record
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search records, issues, tags…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All services" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort: {sort === "recent" ? "Recent" : "Top rated"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSort("recent")}>
                  Most recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("stars")}>
                  Top rated
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[2.2fr_1.1fr_1.2fr_0.9fr_1.6fr_1.1fr_1fr_1.4fr] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Title / Feature</span>
              <span>Service</span>
              <span>Tags</span>
              <span>Type</span>
              <span>Remediation</span>
              <span>Created By</span>
              <span>Stars</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {rows.map((g) => (
                <div
                  key={g.id}
                  className="grid grid-cols-[2.2fr_1.1fr_1.2fr_0.9fr_1.6fr_1.1fr_1fr_1.4fr] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{g.description}</p>
                  </div>
                  <span className="truncate text-sm text-muted-foreground">{g.service}</span>
                  <div className="flex flex-wrap gap-1">
                    {g.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    {g.type}
                  </Badge>
                  <span className="truncate text-sm text-muted-foreground">{g.remediation}</span>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/30 to-indigo-500/30 text-[10px] font-semibold">
                      {g.createdBy.split(" ").map((n) => n[0]).join("")}
                    </span>
                    <span className="truncate text-xs">{g.createdBy}</span>
                  </div>
                  <Stars value={g.stars} />
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Action
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailRecord(g)}>
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyRemediation(g)}>
                          {copiedId === g.id ? (
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Copied!
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <ClipboardCopy className="h-3.5 w-3.5" /> Copy remediation
                            </span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-rose-400"
                          onClick={() => archiveRecord(g.id)}
                        >
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No records match your filters.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Record Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[hsl(222_44%_6%)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-semibold">New Golden Record</h2>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Issue / Problem</label>
                <textarea
                  className="flex min-h-[72px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-none"
                  placeholder="Describe the problem this record addresses…"
                  value={newIssue}
                  onChange={(e) => setNewIssue(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Remediation / Resolution</label>
                <textarea
                  className="flex min-h-[72px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 resize-none"
                  placeholder="Step-by-step fix or resolution…"
                  value={newRemediation}
                  onChange={(e) => setNewRemediation(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Service</label>
                  <input
                    className="flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    placeholder="e.g. api-gateway"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
                  <input
                    className="flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    placeholder="e.g. timeout, database"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={saveNewRecord}
                disabled={newSaving || !newIssue.trim() || !newRemediation.trim() || !newService.trim()}
              >
                {newSaving ? "Saving…" : "Save Record"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDetailRecord(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[hsl(222_44%_6%)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{detailRecord.title}</h2>
                <p className="text-xs text-muted-foreground">{detailRecord.service}</p>
              </div>
              <button
                onClick={() => setDetailRecord(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue</p>
                <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm leading-relaxed">
                  {detailRecord.issue}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Remediation</p>
                <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-sm leading-relaxed text-emerald-300">
                  {detailRecord.remediation}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-1">
                  {detailRecord.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
                <Stars value={detailRecord.stars} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyRemediation(detailRecord)}
              >
                {copiedId === detailRecord.id ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Copied!</>
                ) : (
                  <><ClipboardCopy className="h-4 w-4" /> Copy remediation</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDetailRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
