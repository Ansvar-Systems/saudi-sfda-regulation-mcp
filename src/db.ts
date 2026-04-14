/**
 * SQLite database access layer for the Saudi SFDA MedTech Regulation MCP server.
 *
 * Schema:
 *   - frameworks  — SFDA medical device regulatory frameworks and guidance series
 *   - controls    — Individual requirements within each framework/regulation
 *   - circulars   — SFDA regulatory circulars, guidance documents, and technical notices
 *
 * FTS5 virtual tables back full-text search on controls and circulars.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["SFDA_DB_PATH"] ?? "data/sfda.db";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS db_metadata (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS frameworks (
  id              TEXT    PRIMARY KEY,
  name            TEXT    NOT NULL,
  version         TEXT,
  domain          TEXT,
  description     TEXT,
  control_count   INTEGER DEFAULT 0,
  effective_date  TEXT,
  pdf_url         TEXT
);

CREATE INDEX IF NOT EXISTS idx_frameworks_domain ON frameworks(domain);

CREATE TABLE IF NOT EXISTS controls (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id   TEXT    NOT NULL REFERENCES frameworks(id),
  control_ref    TEXT    NOT NULL UNIQUE,
  domain         TEXT    NOT NULL,
  subdomain      TEXT,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL,
  maturity_level TEXT,
  priority       TEXT
);

CREATE INDEX IF NOT EXISTS idx_controls_framework   ON controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_controls_domain      ON controls(domain);
CREATE INDEX IF NOT EXISTS idx_controls_maturity    ON controls(maturity_level);
CREATE INDEX IF NOT EXISTS idx_controls_priority    ON controls(priority);

CREATE VIRTUAL TABLE IF NOT EXISTS controls_fts USING fts5(
  control_ref, domain, subdomain, title, description,
  content='controls',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS controls_ai AFTER INSERT ON controls BEGIN
  INSERT INTO controls_fts(rowid, control_ref, domain, subdomain, title, description)
  VALUES (new.id, new.control_ref, new.domain, COALESCE(new.subdomain, ''), new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS controls_ad AFTER DELETE ON controls BEGIN
  INSERT INTO controls_fts(controls_fts, rowid, control_ref, domain, subdomain, title, description)
  VALUES ('delete', old.id, old.control_ref, old.domain, COALESCE(old.subdomain, ''), old.title, old.description);
END;

CREATE TRIGGER IF NOT EXISTS controls_au AFTER UPDATE ON controls BEGIN
  INSERT INTO controls_fts(controls_fts, rowid, control_ref, domain, subdomain, title, description)
  VALUES ('delete', old.id, old.control_ref, old.domain, COALESCE(old.subdomain, ''), old.title, old.description);
  INSERT INTO controls_fts(rowid, control_ref, domain, subdomain, title, description)
  VALUES (new.id, new.control_ref, new.domain, COALESCE(new.subdomain, ''), new.title, new.description);
END;

CREATE TABLE IF NOT EXISTS circulars (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reference  TEXT    NOT NULL UNIQUE,
  title      TEXT    NOT NULL,
  date       TEXT,
  category   TEXT,
  summary    TEXT,
  full_text  TEXT    NOT NULL,
  pdf_url    TEXT,
  status     TEXT    DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_circulars_date     ON circulars(date);
CREATE INDEX IF NOT EXISTS idx_circulars_category ON circulars(category);
CREATE INDEX IF NOT EXISTS idx_circulars_status   ON circulars(status);

CREATE VIRTUAL TABLE IF NOT EXISTS circulars_fts USING fts5(
  reference, title, category, summary, full_text,
  content='circulars',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS circulars_ai AFTER INSERT ON circulars BEGIN
  INSERT INTO circulars_fts(rowid, reference, title, category, summary, full_text)
  VALUES (new.id, new.reference, new.title, COALESCE(new.category, ''), COALESCE(new.summary, ''), new.full_text);
END;

CREATE TRIGGER IF NOT EXISTS circulars_ad AFTER DELETE ON circulars BEGIN
  INSERT INTO circulars_fts(circulars_fts, rowid, reference, title, category, summary, full_text)
  VALUES ('delete', old.id, old.reference, old.title, COALESCE(old.category, ''), COALESCE(old.summary, ''), old.full_text);
END;

CREATE TRIGGER IF NOT EXISTS circulars_au AFTER UPDATE ON circulars BEGIN
  INSERT INTO circulars_fts(circulars_fts, rowid, reference, title, category, summary, full_text)
  VALUES ('delete', old.id, old.reference, old.title, COALESCE(old.category, ''), COALESCE(old.summary, ''), old.full_text);
  INSERT INTO circulars_fts(rowid, reference, title, category, summary, full_text)
  VALUES (new.id, new.reference, new.title, COALESCE(new.category, ''), COALESCE(new.summary, ''), new.full_text);
END;
`;

// --- Interfaces ---------------------------------------------------------------

export interface Framework {
  id: string;
  name: string;
  version: string | null;
  domain: string | null;
  description: string | null;
  control_count: number;
  effective_date: string | null;
  pdf_url: string | null;
}

export interface Control {
  id: number;
  framework_id: string;
  control_ref: string;
  domain: string;
  subdomain: string | null;
  title: string;
  description: string;
  maturity_level: string | null;
  priority: string | null;
}

export interface Circular {
  id: number;
  reference: string;
  title: string;
  date: string | null;
  category: string | null;
  summary: string | null;
  full_text: string;
  pdf_url: string | null;
  status: string;
}

// --- DB singleton -------------------------------------------------------------

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH, { readonly: false, fileMustExist: false });
  // journal_mode stays at whatever was set during build (DELETE for a
  // pre-ingested database, so read-only WASM SQLite can open it).
  _db.pragma("foreign_keys = ON");
  _db.exec(SCHEMA_SQL);

  return _db;
}

// --- Framework queries --------------------------------------------------------

export function listFrameworks(): Framework[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM frameworks ORDER BY effective_date DESC")
    .all() as Framework[];
}

export function getFramework(id: string): Framework | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM frameworks WHERE id = ? LIMIT 1")
      .get(id) as Framework | undefined) ?? null
  );
}

// --- Control queries ----------------------------------------------------------

export interface SearchControlsOptions {
  query: string;
  framework?: string | undefined;
  domain?: string | undefined;
  limit?: number | undefined;
}

export function searchControls(opts: SearchControlsOptions): Control[] {
  const db = getDb();
  const limit = opts.limit ?? 10;

  const conditions: string[] = ["controls_fts MATCH :query"];
  const params: Record<string, unknown> = { query: opts.query, limit };

  if (opts.framework) {
    conditions.push("c.framework_id = :framework");
    params["framework"] = opts.framework;
  }
  if (opts.domain) {
    conditions.push("c.domain = :domain");
    params["domain"] = opts.domain;
  }

  const where = conditions.join(" AND ");
  return db
    .prepare(
      `SELECT c.*, snippet(controls_fts, 4, '[', ']', '...', 20) AS _snippet
       FROM controls_fts f
       JOIN controls c ON c.id = f.rowid
       WHERE ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params) as Control[];
}

export function getControl(controlRef: string): Control | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM controls WHERE control_ref = ? LIMIT 1")
      .get(controlRef) as Control | undefined) ?? null
  );
}

// --- Circular queries ---------------------------------------------------------

export interface SearchCircularsOptions {
  query: string;
  category?: string | undefined;
  limit?: number | undefined;
}

export function searchCirculars(opts: SearchCircularsOptions): Circular[] {
  const db = getDb();
  const limit = opts.limit ?? 10;

  const conditions: string[] = ["circulars_fts MATCH :query"];
  const params: Record<string, unknown> = { query: opts.query, limit };

  if (opts.category) {
    conditions.push("c.category = :category");
    params["category"] = opts.category;
  }

  const where = conditions.join(" AND ");
  return db
    .prepare(
      `SELECT c.*, snippet(circulars_fts, 4, '[', ']', '...', 20) AS _snippet
       FROM circulars_fts f
       JOIN circulars c ON c.id = f.rowid
       WHERE ${where}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(params) as Circular[];
}

export function getCircular(reference: string): Circular | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM circulars WHERE reference = ? LIMIT 1")
      .get(reference) as Circular | undefined) ?? null
  );
}

// --- Combined search ----------------------------------------------------------

export interface SearchRegulationsOptions {
  query: string;
  domain?: string | undefined;
  limit?: number | undefined;
}

export interface RegulationResult {
  type: "control" | "circular";
  id: string;
  title: string;
  reference: string;
  domain: string | null;
  summary: string | null;
  rank: number;
}

export function searchRegulations(opts: SearchRegulationsOptions): RegulationResult[] {
  const db = getDb();
  const limit = opts.limit ?? 10;
  const halfLimit = Math.ceil(limit / 2);

  const controlParams: Record<string, unknown> = { query: opts.query, limit: halfLimit };
  const circularParams: Record<string, unknown> = { query: opts.query, limit: halfLimit };

  let controlWhere = "controls_fts MATCH :query";
  if (opts.domain) {
    controlWhere += " AND c.domain = :domain";
    controlParams["domain"] = opts.domain;
  }

  const controls = db
    .prepare(
      `SELECT 'control' AS type, c.control_ref AS id, c.title, c.control_ref AS reference,
              c.domain, SUBSTR(c.description, 1, 200) AS summary, rank
       FROM controls_fts f
       JOIN controls c ON c.id = f.rowid
       WHERE ${controlWhere}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(controlParams) as RegulationResult[];

  let circularWhere = "circulars_fts MATCH :query";
  if (opts.domain) {
    circularWhere += " AND c.category = :domain";
    circularParams["domain"] = opts.domain;
  }

  const circulars = db
    .prepare(
      `SELECT 'circular' AS type, CAST(c.id AS TEXT) AS id, c.title, c.reference,
              c.category AS domain, c.summary, rank
       FROM circulars_fts f
       JOIN circulars c ON c.id = f.rowid
       WHERE ${circularWhere}
       ORDER BY rank
       LIMIT :limit`,
    )
    .all(circularParams) as RegulationResult[];

  // Merge, sort by rank (lower is better in FTS5 BM25), deduplicate
  const merged = [...controls, ...circulars];
  merged.sort((a, b) => a.rank - b.rank);
  return merged.slice(0, limit);
}

// --- Stats --------------------------------------------------------------------

export interface DbStats {
  frameworks: number;
  controls: number;
  circulars: number;
}

export function getStats(): DbStats {
  const db = getDb();
  const frameworks = (db.prepare("SELECT COUNT(*) AS n FROM frameworks").get() as { n: number }).n;
  const controls = (db.prepare("SELECT COUNT(*) AS n FROM controls").get() as { n: number }).n;
  const circulars = (db.prepare("SELECT COUNT(*) AS n FROM circulars").get() as { n: number }).n;
  return { frameworks, controls, circulars };
}

// --- Database metadata --------------------------------------------------------

export function getDbMetadata(): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM db_metadata")
    .all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
