import type { PrismaClient } from "@prisma/client";
import crypto from "crypto";

export type ReleaseEntry = {
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

export type ReleaseInput = Partial<Omit<ReleaseEntry, "id" | "createdAt" | "updatedAt" | "publishedAt">> & {
  version?: string;
};

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/g)
      .map((item) => item.trim().replace(/^[-*\s]+/, ""))
      .filter(Boolean);
  }
  return [];
}

function parseVersion(version: string): number[] {
  return String(version || "")
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0)
    .slice(0, 3);
}

function compareVersion(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function nextVersion(current?: string | null): string {
  const parsed = parseVersion(String(current || "1.0.0"));
  if (parsed.length < 3) {
    while (parsed.length < 3) parsed.push(0);
  }
  parsed[2] = (parsed[2] || 0) + 1;
  return parsed.join(".");
}

function toEntry(row: any): ReleaseEntry {
  return {
    id: String(row.id || ""),
    version: String(row.version || ""),
    title: String(row.title || ""),
    summary: String(row.summary || ""),
    notes: String(row.notes || ""),
    changes: Array.isArray(row.changes) ? row.changes.map((x: any) => String(x || "")) : [],
    newFeatures: Array.isArray(row.new_features) ? row.new_features.map((x: any) => String(x || "")) : [],
    removed: Array.isArray(row.removed) ? row.removed.map((x: any) => String(x || "")) : [],
    settingsChanges: Array.isArray(row.settings_changes) ? row.settings_changes.map((x: any) => String(x || "")) : [],
    packageUrl: String(row.package_url || ""),
    sha256: String(row.sha256 || ""),
    channel: String(row.channel || "stable"),
    critical: Boolean(row.critical),
    published: Boolean(row.published),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function manifestFromRelease(release: ReleaseEntry) {
  return {
    version: release.version,
    title: release.title,
    notes: release.notes,
    summary: release.summary,
    changes: release.changes,
    new_features: release.newFeatures,
    removed: release.removed,
    settings_changes: release.settingsChanges,
    package_url: release.packageUrl,
    sha256: release.sha256,
    critical: release.critical,
    channel: release.channel,
    published_at: release.publishedAt,
  };
}

export class UpdateReleaseService {
  constructor(private prisma: PrismaClient) {}

  async ensureSchema() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS update_releases (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        changes JSONB NOT NULL DEFAULT '[]'::jsonb,
        new_features JSONB NOT NULL DEFAULT '[]'::jsonb,
        removed JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
        package_url TEXT NOT NULL DEFAULT '',
        sha256 TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL DEFAULT 'stable',
        critical BOOLEAN NOT NULL DEFAULT FALSE,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_update_releases_published
      ON update_releases (published, published_at DESC)
    `);
  }

  async listReleases(): Promise<ReleaseEntry[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM update_releases ORDER BY COALESCE(published_at, updated_at, created_at) DESC, version DESC`
    );
    return rows.map(toEntry);
  }

  async getById(id: string): Promise<ReleaseEntry | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM update_releases WHERE id = $1 LIMIT 1`,
      id
    );
    return rows.length ? toEntry(rows[0]) : null;
  }

  async getPublishedRelease(): Promise<ReleaseEntry | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM update_releases WHERE published = TRUE ORDER BY COALESCE(published_at, updated_at, created_at) DESC LIMIT 1`
    );
    return rows.length ? toEntry(rows[0]) : null;
  }

  async createRelease(input: ReleaseInput, actorId?: string | null): Promise<ReleaseEntry> {
    const releases = await this.listReleases();
    const suggested = nextVersion(releases[0]?.version || "1.0.0");
    const release = {
      id: crypto.randomUUID(),
      version: String(input.version || suggested).trim() || suggested,
      title: String(input.title || "").trim(),
      summary: String(input.summary || "").trim(),
      notes: String(input.notes || "").trim(),
      changes: normalizeList(input.changes),
      newFeatures: normalizeList(input.newFeatures),
      removed: normalizeList(input.removed),
      settingsChanges: normalizeList(input.settingsChanges),
      packageUrl: String(input.packageUrl || "").trim(),
      sha256: String(input.sha256 || "").trim().toLowerCase(),
      channel: String(input.channel || "stable").trim() || "stable",
      critical: Boolean(input.critical),
      published: Boolean(input.published),
    };

    const row = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO update_releases
        (id, version, title, summary, notes, changes, new_features, removed, settings_changes, package_url, sha256, channel, critical, published, published_at, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, CASE WHEN $14 THEN NOW() ELSE NULL END, NOW(), NOW())
      RETURNING *
      `,
      release.id,
      release.version,
      release.title,
      release.summary,
      release.notes,
      JSON.stringify(release.changes),
      JSON.stringify(release.newFeatures),
      JSON.stringify(release.removed),
      JSON.stringify(release.settingsChanges),
      release.packageUrl,
      release.sha256,
      release.channel,
      release.critical,
      release.published
    );

    await this.logAction(actorId, "update_release_create", `Created release ${release.version}`);
    return toEntry(row[0]);
  }

  async updateRelease(id: string, input: ReleaseInput, actorId?: string | null): Promise<ReleaseEntry | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const version = String(input.version || existing.version).trim() || existing.version;
    const title = String(input.title ?? existing.title).trim();
    const summary = String(input.summary ?? existing.summary).trim();
    const notes = String(input.notes ?? existing.notes).trim();
    const changes = input.changes !== undefined ? normalizeList(input.changes) : existing.changes;
    const newFeatures = input.newFeatures !== undefined ? normalizeList(input.newFeatures) : existing.newFeatures;
    const removed = input.removed !== undefined ? normalizeList(input.removed) : existing.removed;
    const settingsChanges = input.settingsChanges !== undefined ? normalizeList(input.settingsChanges) : existing.settingsChanges;
    const packageUrl = String(input.packageUrl ?? existing.packageUrl).trim();
    const sha256 = String(input.sha256 ?? existing.sha256).trim().toLowerCase();
    const channel = String(input.channel ?? existing.channel).trim() || "stable";
    const critical = typeof input.critical === "boolean" ? input.critical : existing.critical;
    const published = typeof input.published === "boolean" ? input.published : existing.published;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      UPDATE update_releases
      SET version = $2, title = $3, summary = $4, notes = $5,
          changes = $6::jsonb, new_features = $7::jsonb, removed = $8::jsonb, settings_changes = $9::jsonb,
          package_url = $10, sha256 = $11, channel = $12, critical = $13, published = $14,
          published_at = CASE WHEN $14 THEN COALESCE(published_at, NOW()) ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      id,
      version,
      title,
      summary,
      notes,
      JSON.stringify(changes),
      JSON.stringify(newFeatures),
      JSON.stringify(removed),
      JSON.stringify(settingsChanges),
      packageUrl,
      sha256,
      channel,
      critical,
      published
    );

    await this.logAction(actorId, "update_release_update", `Updated release ${version}`);
    return rows.length ? toEntry(rows[0]) : null;
  }

  async deleteRelease(id: string, actorId?: string | null): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await this.prisma.$executeRawUnsafe(`DELETE FROM update_releases WHERE id = $1`, id);
    await this.logAction(actorId, "update_release_delete", `Deleted release ${existing.version}`);
    return true;
  }

  async publishRelease(id: string, actorId?: string | null): Promise<ReleaseEntry | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      UPDATE update_releases
      SET published = TRUE, published_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      id
    );
    await this.logAction(actorId, "update_release_publish", `Published release ${existing.version}`);
    return rows.length ? toEntry(rows[0]) : null;
  }

  async getManifest(): Promise<Record<string, unknown> | null> {
    const release = await this.getPublishedRelease();
    if (!release) return null;
    return manifestFromRelease(release);
  }

  suggestVersionFromList(releases: ReleaseEntry[]): string {
    const latest = releases.reduce((best, item) => (!best || compareVersion(item.version, best.version) > 0 ? item : best), null as ReleaseEntry | null);
    return nextVersion(latest?.version || "1.0.0");
  }

  private async logAction(userId: string | null | undefined, action: string, details: string) {
    if (!userId) return;
    try {
      await this.prisma.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          action,
          details,
        },
      });
    } catch {
      // Best-effort audit only.
    }
  }
}
