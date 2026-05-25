import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Package2, Plus, Rocket, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type ReleaseEntry = {
  id: string;
  version: string;
  title: string;
  summary: string;
  notes: string;
  changes: string[];
  newFeatures: string[];
  removed: string[];
  settingsChanges: string[];
  packageUrl: string;
  sha256: string;
  channel: string;
  critical: boolean;
  published: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReleaseResponse = {
  releases: ReleaseEntry[];
  nextVersion: string;
  publishedManifest: any | null;
};

type ReleaseForm = {
  version: string;
  title: string;
  summary: string;
  notes: string;
  changes: string;
  newFeatures: string;
  removed: string;
  settingsChanges: string;
  packageUrl: string;
  sha256: string;
  channel: string;
  critical: boolean;
};

const emptyForm = (nextVersion = "1.0.0"): ReleaseForm => ({
  version: nextVersion,
  title: "",
  summary: "",
  notes: "",
  changes: "",
  newFeatures: "",
  removed: "",
  settingsChanges: "",
  packageUrl: "",
  sha256: "",
  channel: "stable",
  critical: false,
});

function toText(items: string[] | undefined) {
  return (items || []).join("\n");
}

function splitText(value: string) {
  return String(value || "")
    .split(/\r?\n|,/g)
    .map((item) => item.trim().replace(/^[-*\s]+/, ""))
    .filter(Boolean);
}

function manifestUrl() {
  return `${window.location.origin}/api/update-manifest`;
}

const releaseFieldClass =
  "rounded-2xl border border-cyan-200/20 bg-slate-950/75 text-slate-50 shadow-inner shadow-black/30 placeholder:text-slate-400 caret-cyan-300 selection:bg-cyan-400/30 selection:text-white focus-visible:border-cyan-300/60 focus-visible:ring-cyan-400/40";

const releaseTextAreaClass =
  "min-h-[88px] rounded-[24px] border border-cyan-200/20 bg-slate-950/75 text-slate-50 shadow-inner shadow-black/30 placeholder:text-slate-400 caret-cyan-300 selection:bg-cyan-400/30 selection:text-white focus-visible:border-cyan-300/60 focus-visible:ring-cyan-400/40";

function ReleaseStudioSkeleton() {
  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="animate-pulse rounded-[32px] border border-white/10 bg-card/50 p-6 shadow-2xl">
        <div className="h-7 w-60 rounded-full bg-white/10" />
        <div className="mt-4 h-4 w-2/3 rounded-full bg-white/10" />
        <div className="mt-8 grid gap-4 md:grid-cols-[360px_1fr]">
          <div className="space-y-4 rounded-3xl bg-white/5 p-4">
            <div className="h-10 rounded-2xl bg-white/10" />
            <div className="h-20 rounded-2xl bg-white/10" />
            <div className="h-20 rounded-2xl bg-white/10" />
            <div className="h-20 rounded-2xl bg-white/10" />
          </div>
          <div className="space-y-4 rounded-3xl bg-white/5 p-4">
            <div className="h-10 rounded-2xl bg-white/10" />
            <div className="h-48 rounded-3xl bg-white/10" />
            <div className="h-48 rounded-3xl bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Releases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("new");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<ReleaseForm>(emptyForm());

  const { data, isLoading, refetch } = useQuery<ReleaseResponse>({
    queryKey: ["owner-releases"],
    queryFn: async () => {
      const res = await fetch("/api/releases", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Unable to load release studio");
      }
      return await res.json();
    },
  });

  const releases = data?.releases || [];
  const nextVersion = data?.nextVersion || "1.0.0";
  const selected = selectedId === "new" ? null : releases.find((item) => item.id === selectedId) || null;
  const manifest = data?.publishedManifest || null;

  useEffect(() => {
    if (selected) {
      setForm({
        version: selected.version,
        title: selected.title || "",
        summary: selected.summary || "",
        notes: selected.notes || "",
        changes: toText(selected.changes),
        newFeatures: toText(selected.newFeatures),
        removed: toText(selected.removed),
        settingsChanges: toText(selected.settingsChanges),
        packageUrl: selected.packageUrl || "",
        sha256: selected.sha256 || "",
        channel: selected.channel || "stable",
        critical: Boolean(selected.critical),
      });
    } else {
      setForm(emptyForm(nextVersion));
    }
  }, [selectedId, selected?.id, nextVersion]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return releases;
    return releases.filter((item) => {
      const hay = [
        item.version,
        item.title,
        item.summary,
        item.notes,
        ...item.changes,
        ...item.newFeatures,
        ...item.removed,
        ...item.settingsChanges,
        item.channel,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [releases, search]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; body: any }) => {
      const url = payload.id ? `/api/releases/${payload.id}` : "/api/releases";
      const res = await fetch(url, {
        method: payload.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload.body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Save failed");
      return data as ReleaseEntry;
    },
    onSuccess: async (release) => {
      toast({ title: "Release saved", description: `${release.version} is ready.` });
      await qc.invalidateQueries({ queryKey: ["owner-releases"] });
      setSelectedId(release.id);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/releases/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Publish failed");
      return data as ReleaseEntry;
    },
    onSuccess: async (release) => {
      toast({
        title: "Published",
        description: `${release.version} is now live for desktop apps.`,
      });
      await qc.invalidateQueries({ queryKey: ["owner-releases"] });
      setSelectedId(release.id);
    },
    onError: (error: Error) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/releases/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Delete failed");
      }
    },
    onSuccess: async () => {
      toast({ title: "Draft deleted", description: "The release entry has been removed." });
      await qc.invalidateQueries({ queryKey: ["owner-releases"] });
      setSelectedId("new");
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const updateField = (key: keyof ReleaseForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const autoSuggestVersion = async () => {
    try {
      const res = await fetch("/api/releases", { credentials: "include" });
      const data = await res.json();
      if (data?.nextVersion) {
        updateField("version", data.nextVersion);
        toast({ title: "Version suggested", description: `Auto calculated as ${data.nextVersion}.` });
      }
    } catch {
      updateField("version", nextVersion);
    }
  };

  const handleSave = async () => {
    const body = {
      version: form.version.trim() || nextVersion,
      title: form.title.trim(),
      summary: form.summary.trim(),
      notes: form.notes.trim(),
      changes: splitText(form.changes),
      newFeatures: splitText(form.newFeatures),
      removed: splitText(form.removed),
      settingsChanges: splitText(form.settingsChanges),
      packageUrl: form.packageUrl.trim(),
      sha256: form.sha256.trim(),
      channel: form.channel.trim() || "stable",
      critical: Boolean(form.critical),
    };
    await saveMutation.mutateAsync({ id: selected?.id || undefined, body });
  };

  const handlePublish = async () => {
    const body = {
      version: form.version.trim() || nextVersion,
      title: form.title.trim(),
      summary: form.summary.trim(),
      notes: form.notes.trim(),
      changes: splitText(form.changes),
      newFeatures: splitText(form.newFeatures),
      removed: splitText(form.removed),
      settingsChanges: splitText(form.settingsChanges),
      packageUrl: form.packageUrl.trim(),
      sha256: form.sha256.trim(),
      channel: form.channel.trim() || "stable",
      critical: Boolean(form.critical),
      published: true,
    };
    const saved = await saveMutation.mutateAsync({ id: selected?.id || undefined, body });
    await publishMutation.mutateAsync(saved.id);
  };

  const copyManifest = async () => {
    await navigator.clipboard.writeText(manifestUrl());
    setCopied(true);
    toast({ title: "Manifest URL copied", description: "Use this in the desktop app update settings." });
    setTimeout(() => setCopied(false), 1400);
  };

  const publicStats = [
    { label: "Drafts", value: releases.filter((r) => !r.published).length },
    { label: "Published", value: releases.filter((r) => r.published).length },
    { label: "Latest", value: data?.nextVersion || "1.0.0" },
    { label: "Manifest", value: manifest ? "Live" : "Waiting" },
  ];

  if (isLoading) return <ReleaseStudioSkeleton />;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_30%),linear-gradient(180deg,_rgba(8,15,30,0.98),_rgba(13,19,36,0.98))] p-4 text-slate-100 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-7xl space-y-5"
      >
        <Card className="border-white/10 bg-white/8 shadow-2xl shadow-black/20 backdrop-blur-2xl">
          <CardContent className="p-6 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-cyan-200 uppercase">
                  Private Release Studio
                </div>
                <h1 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
                  Ship updates like a product team, not a spreadsheet.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Draft versions, fill release details, preview user-facing notes, and publish a manifest for the desktop app to sync automatically. The license system stays exactly as-is alongside this update publisher.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {publicStats.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/10">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid min-w-[280px] gap-3 rounded-[28px] border border-white/10 bg-slate-950/40 p-4 shadow-xl">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Public Manifest</span>
                  <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">Desktop sync ready</Badge>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3 font-mono text-xs text-slate-200">
                  {manifestUrl()}
                </div>
                <div className="flex gap-2">
                  <Button onClick={copyManifest} className="flex-1 rounded-2xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    Copy URL
                  </Button>
                  <Button variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => refetch()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <Card className="border-white/10 bg-white/6 shadow-2xl shadow-black/20 backdrop-blur-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-white">
                <Package2 className="h-5 w-5 text-cyan-300" />
                Versions
              </CardTitle>
              <CardDescription className="text-slate-300">Drafts and live versions in one place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search versions, notes, settings..."
                  className={releaseFieldClass}
                />
                <Button
                  className="rounded-2xl bg-white/10 text-white hover:bg-white/15"
                  onClick={() => {
                    setSelectedId("new");
                    setForm(emptyForm(nextVersion));
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-320px)] pr-2">
                <div className="space-y-3">
                  {filtered.map((release) => {
                    const active = release.id === selectedId;
                    return (
                      <button
                        key={release.id}
                        onClick={() => setSelectedId(release.id)}
                        className={[
                          "w-full rounded-[24px] border p-4 text-left transition-all duration-200",
                          active
                            ? "border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-500/10"
                            : "border-white/10 bg-white/5 hover:bg-white/8",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-white">{release.version}</div>
                            <div className="text-xs text-slate-400">{release.title || "Untitled release"}</div>
                          </div>
                          <Badge className={release.published ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}>
                            {release.published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                          {release.summary || release.notes || "No summary yet."}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          <span>{release.channel || "stable"}</span>
                          <span>{release.updatedAt ? formatDistanceToNow(new Date(release.updatedAt), { addSuffix: true }) : "just now"}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!filtered.length && (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                      No releases found.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-white/10 bg-white/6 shadow-2xl shadow-black/20 backdrop-blur-2xl">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Sparkles className="h-5 w-5 text-fuchsia-300" />
                      Release Editor
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                      Fill the details once. The desktop app will read the manifest automatically after publish.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/10 text-slate-200">Next: {nextVersion}</Badge>
                    {selected?.published && <Badge className="bg-emerald-500/15 text-emerald-300">Live release</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Version</label>
                    <div className="flex gap-2">
                      <Input
                        value={form.version}
                        onChange={(e) => updateField("version", e.target.value)}
                        placeholder={nextVersion}
                        className={releaseFieldClass}
                      />
                      <Button variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={autoSuggestVersion}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Auto
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Channel</label>
                    <Input
                      value={form.channel}
                      onChange={(e) => updateField("channel", e.target.value)}
                      placeholder="stable"
                      className={releaseFieldClass}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Title</label>
                    <Input
                      value={form.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="Cleaner update browser"
                      className={releaseFieldClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Package URL</label>
                    <Input
                      value={form.packageUrl}
                      onChange={(e) => updateField("packageUrl", e.target.value)}
                      placeholder="https://..."
                      className={releaseFieldClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Summary</label>
                  <Textarea
                    value={form.summary}
                    onChange={(e) => updateField("summary", e.target.value)}
                    placeholder="Short release summary for users."
                    className={releaseTextAreaClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Notes</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="User-friendly release notes, one line per point."
                    className={releaseTextAreaClass}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">New Features</label>
                    <Textarea
                      value={form.newFeatures}
                      onChange={(e) => updateField("newFeatures", e.target.value)}
                      placeholder="One item per line"
                      className={releaseTextAreaClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Removed / Replaced</label>
                    <Textarea
                      value={form.removed}
                      onChange={(e) => updateField("removed", e.target.value)}
                      placeholder="One item per line"
                      className={releaseTextAreaClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Settings Changes</label>
                    <Textarea
                      value={form.settingsChanges}
                      onChange={(e) => updateField("settingsChanges", e.target.value)}
                      placeholder="One item per line"
                      className={releaseTextAreaClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Other Changes</label>
                    <Textarea
                      value={form.changes}
                      onChange={(e) => updateField("changes", e.target.value)}
                      placeholder="One item per line"
                      className={releaseTextAreaClass}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">SHA-256</label>
                    <Input
                      value={form.sha256}
                      onChange={(e) => updateField("sha256", e.target.value)}
                      placeholder="hash for integrity"
                      className={`${releaseFieldClass} font-mono`}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/6 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Critical Update</div>
                      <div className="text-xs text-slate-400">Force users to treat it as important.</div>
                    </div>
                    <Switch checked={form.critical} onCheckedChange={(checked) => updateField("critical", checked)} />
                  </div>
                  <div className="flex items-center gap-2 rounded-[24px] border border-white/10 bg-white/6 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-200">Selected version</div>
                      <div className="truncate text-xs text-slate-400">{selected ? selected.version : "New draft"}</div>
                    </div>
                    <Badge className="bg-white/10 text-slate-200">{selected?.published ? "Published" : "Draft"}</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    className="rounded-2xl bg-white text-slate-950 hover:bg-slate-200"
                    onClick={handleSave}
                    disabled={saveMutation.isPending || publishMutation.isPending}
                  >
                    Save Draft
                  </Button>
                  <Button
                    className="rounded-2xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    onClick={handlePublish}
                    disabled={saveMutation.isPending || publishMutation.isPending}
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    Publish to Users
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => {
                      setSelectedId("new");
                      setForm(emptyForm(nextVersion));
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Draft
                  </Button>
                  {selected && (
                    <Button
                      variant="outline"
                      className="rounded-2xl border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                      onClick={() => {
                        if (confirm(`Delete ${selected.version}?`)) deleteMutation.mutate(selected.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-white/10 bg-white/6 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                <CardHeader>
                  <CardTitle className="text-white">Friendly Release Preview</CardTitle>
                  <CardDescription className="text-slate-300">These are the exact cards your users will understand.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { title: "Release Notes", value: form.notes },
                    { title: "New Features", value: form.newFeatures },
                    { title: "Removed or Replaced", value: form.removed },
                    { title: "Settings Changes", value: form.settingsChanges },
                    { title: "Other Changes", value: form.changes },
                  ].map((block) => {
                    const items = splitText(block.value);
                    return (
                      <div key={block.title} className="rounded-[24px] border border-white/10 bg-slate-950/30 p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{block.title}</div>
                        {items.length ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {items.map((item, idx) => (
                              <div key={`${block.title}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-200">
                                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-200">
                                  {idx + 1}
                                </span>
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">No items yet.</div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-gradient-to-br from-cyan-500/10 via-fuchsia-500/10 to-indigo-500/10 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                <CardHeader>
                  <CardTitle className="text-white">Publish Summary</CardTitle>
                  <CardDescription className="text-slate-200/80">What the desktop app sees after you push this release.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Manifest URL</div>
                    <div className="mt-2 break-all font-mono text-sm text-white">{manifestUrl()}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Package URL</div>
                      <div className="mt-2 break-all text-sm text-slate-200">{form.packageUrl || "Not set"}</div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Channel</div>
                      <div className="mt-2 text-sm text-slate-200">{form.channel || "stable"}</div>
                    </div>
                  </div>
                  <Separator className="bg-white/10" />
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">User Summary</div>
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-200">
                      {form.summary || form.notes || "No summary written yet."}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    Once published, the desktop app can pull this release without you touching the main codebase.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
