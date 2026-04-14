/**
 * Build the SFDA SQLite database from fetched raw data.
 *
 * Reads .meta.json files written by ingest-fetch.ts (new SFDA shape with
 * title_en / title_ar / reference / publishedAt / categorySlug), classifies
 * each document, and inserts rows into frameworks or circulars.
 *
 * Classification:
 *   - "framework": longer guidance / general regulatory framework documents
 *     (e.g., general requirements, classification rules, guidance series).
 *   - "circular":  specific requirement regulations (MDS-REQ*, Drug-*,
 *     procedural rules) — matches the circulars table's "reference, title,
 *     full_text" shape cleanly.
 *
 * Usage:
 *   npx tsx scripts/build-db.ts
 *   npx tsx scripts/build-db.ts --force   # drop and rebuild database
 *   npx tsx scripts/build-db.ts --dry-run # log what would be inserted
 */

import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_PATH = process.env["SFDA_DB_PATH"] ?? "data/sfda.db";
const RAW_DIR = "data/raw";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FetchedDocument {
  title_en: string;
  title_ar: string;
  url: string;
  category: string;
  categorySlug: string;
  publishedAt: string; // YYYY-MM-DD (from portal, may be "")
  reference: string;
  filename: string;
  text: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Document classification
// ---------------------------------------------------------------------------

function classifyDocument(doc: FetchedDocument): "framework" | "circular" {
  // References that look like numbered requirements go in circulars.
  if (/\b(MDS[-\s]?REQ|MDS[-\s]?G|Drug[-\s]?\d)/i.test(doc.reference) || /\b(MDS[-\s]?REQ|MDS[-\s]?G|Drug[-\s]?\d)/i.test(doc.title_en)) {
    return "circular";
  }
  // Guidance / framework documents.
  const t = doc.title_en.toLowerCase();
  if (t.includes("framework") || t.includes("guidance") || t.includes("guideline") || t.includes("rules")) {
    return "framework";
  }
  // Long documents -> framework, short -> circular.
  return doc.text.length > 30_000 ? "framework" : "circular";
}

function inferFrameworkId(doc: FetchedDocument): string {
  // Prefer extracted reference if already slug-ish.
  const ref = doc.reference.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (ref) return `sfda-${ref}`;
  const stem = doc.filename.replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `sfda-${stem}`;
}

function isoDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  // Accept "YYYY-MM-DD".
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Accept "DD Month YYYY".
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };
  const m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const month = months[m[2]!.toLowerCase()];
    if (month) return `${m[3]}-${month}-${m[1]!.padStart(2, "0")}`;
  }
  return null;
}

function extractDateFromText(text: string): string | null {
  const patterns: RegExp[] = [
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    if (match[2] && /[a-z]/i.test(match[2])) {
      const months: Record<string, string> = {
        january: "01", february: "02", march: "03", april: "04",
        may: "05", june: "06", july: "07", august: "08",
        september: "09", october: "10", november: "11", december: "12",
      };
      const month = months[match[2]!.toLowerCase()] ?? "01";
      return `${match[3]}-${month}-${match[1]!.padStart(2, "0")}`;
    }
    if (/^\d{4}$/.test(match[1] ?? "")) return match[0]!;
  }
  return null;
}

function buildSummary(text: string, maxLen = 500): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 50);
  const first = lines[0] ?? "";
  return first.length > maxLen ? first.substring(0, maxLen) + "..." : first;
}

function displayTitle(doc: FetchedDocument): string {
  // Primary title is English; append the Arabic title in parentheses if present.
  if (doc.title_ar && doc.title_ar !== doc.title_en) {
    return `${doc.title_en} | ${doc.title_ar}`;
  }
  return doc.title_en;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    console.error(`Raw data directory not found: ${RAW_DIR}`);
    console.error("Run: npm run ingest:fetch");
    process.exit(1);
  }

  const metaFiles = readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".meta.json"))
    .sort();

  if (metaFiles.length === 0) {
    console.warn("No .meta.json files found. Run: npm run ingest:fetch");
    return;
  }

  console.log(`Found ${metaFiles.length} fetched documents`);

  if (dryRun) {
    for (const f of metaFiles) {
      const doc: FetchedDocument = JSON.parse(readFileSync(join(RAW_DIR, f), "utf8"));
      const type = classifyDocument(doc);
      console.log(`  [${type}] ${doc.title_en} (${doc.text.length.toLocaleString()} chars) [${doc.category}]`);
    }
    return;
  }

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (force && existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log(`Deleted ${DB_PATH}`);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  const insertFramework = db.prepare(
    "INSERT OR IGNORE INTO frameworks (id, name, version, domain, description, control_count, effective_date, pdf_url) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertControl = db.prepare(
    "INSERT OR IGNORE INTO controls " +
      "(framework_id, control_ref, domain, subdomain, title, description, maturity_level, priority) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertCircular = db.prepare(
    "INSERT OR IGNORE INTO circulars (reference, title, date, category, summary, full_text, pdf_url, status) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  let frameworksInserted = 0;
  let controlsInserted = 0;
  let circularsInserted = 0;
  const usedReferences = new Set<string>();

  function uniqueReference(base: string): string {
    let candidate = base;
    let n = 2;
    while (usedReferences.has(candidate)) {
      candidate = `${base}-${n++}`;
    }
    usedReferences.add(candidate);
    return candidate;
  }

  for (const metaFile of metaFiles) {
    const doc: FetchedDocument = JSON.parse(readFileSync(join(RAW_DIR, metaFile), "utf8"));
    const type = classifyDocument(doc);
    console.log(`Processing [${type}]: ${doc.title_en}`);

    const date = isoDate(doc.publishedAt) ?? extractDateFromText(doc.text);
    const title = displayTitle(doc);

    if (type === "framework") {
      const frameworkId = uniqueReference(inferFrameworkId(doc));
      const result = insertFramework.run(
        frameworkId,
        title,
        null,
        doc.category,
        buildSummary(doc.text, 1000) || title,
        0,
        date,
        doc.url,
      );
      if (result.changes > 0) frameworksInserted++;

      // Seed one representative control entry so the framework is searchable
      // via the controls FTS path. Real per-provision extraction requires
      // document-specific heuristics and is out of scope for initial ingest.
      const controlRef = uniqueReference(`${frameworkId.toUpperCase()}-GENERAL`);
      const controlResult = insertControl.run(
        frameworkId,
        controlRef,
        doc.category,
        "General",
        `${doc.title_en} — General Requirements`,
        doc.text.substring(0, 4000) || `See full document at ${doc.url}`,
        null,
        null,
      );
      if (controlResult.changes > 0) controlsInserted++;
    } else {
      const reference = uniqueReference(doc.reference || `SFDA-${doc.filename.replace(/\.pdf$/i, "").toUpperCase()}`);
      const result = insertCircular.run(
        reference,
        title,
        date,
        doc.category,
        buildSummary(doc.text),
        doc.text || `See full document at: ${doc.url}`,
        doc.url,
        "active",
      );
      if (result.changes > 0) circularsInserted++;
    }
  }

  // Record build metadata so runtime tools (e.g. check_data_freshness) and
  // audit scripts can read `data_age` without re-parsing coverage.json.
  const nowIso = new Date().toISOString();
  const metaInsert = db.prepare(
    "INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)",
  );
  metaInsert.run("built_at", nowIso);
  metaInsert.run("source", "https://sfda.gov.sa/en/regulations");
  metaInsert.run(
    "mcp_name",
    "Saudi SFDA MedTech Regulation MCP",
  );
  metaInsert.run("language_primary", "en");
  metaInsert.run("languages", "en,ar");

  // Keep journal_mode = DELETE for deployment compatibility (WAL files
  // cannot be opened by read-only WASM SQLite). See mcp-golden-standard.md.
  db.pragma("vacuum");

  console.log(`
Build complete:
  Frameworks : ${frameworksInserted} inserted
  Controls   : ${controlsInserted} inserted
  Circulars  : ${circularsInserted} inserted

Database: ${DB_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
