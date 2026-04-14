/**
 * Update data/coverage.json with current database statistics.
 *
 * Reads the SFDA SQLite database and merges live counts / timestamps into the
 * existing coverage manifest, preserving the golden-standard static fields
 * (scope_statement, gaps, tools, etc.). Writes COVERAGE.md from the merged
 * result.
 *
 * Usage:
 *   npx tsx scripts/update-coverage.ts
 */

import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env["SFDA_DB_PATH"] ?? "data/sfda.db";
const COVERAGE_FILE = "data/coverage.json";

interface CoverageSource {
  id?: string;
  name: string;
  authority?: string;
  url?: string;
  version?: string;
  item_count?: number;
  expected_items?: number;
  item_type?: string;
  measurement_unit?: string;
  last_fetched?: string | null;
  last_refresh?: string | null;
  last_verified?: string | null;
  refresh_frequency?: string;
  update_frequency?: string;
  verification_method?: string;
  completeness?: string;
  completeness_note?: string;
  status?: "current" | "stale" | "unknown";
}

interface CoverageFile {
  schema_version?: string;
  mcp_name?: string;
  mcp_type?: string;
  coverage_type?: string;
  coverage_date?: string;
  database_version?: string;
  scope_statement?: string;
  scope_exclusions?: string[];
  languages?: string[];
  language_primary?: string;
  jurisdictions?: string[];
  sectors?: string[];
  sources: CoverageSource[];
  gaps?: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  totals: { frameworks: number; controls: number; circulars: number };
  summary?: Record<string, number>;
  generatedAt?: string;
  mcp?: string;
  version?: string;
}

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    console.error("Run: npm run seed  or  npm run build:db");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const frameworks = (db.prepare("SELECT COUNT(*) AS n FROM frameworks").get() as { n: number }).n;
  const controls = (db.prepare("SELECT COUNT(*) AS n FROM controls").get() as { n: number }).n;
  const circulars = (db.prepare("SELECT COUNT(*) AS n FROM circulars").get() as { n: number }).n;
  const totalRows = frameworks + controls + circulars;

  const latestCircular = db
    .prepare("SELECT date FROM circulars WHERE date IS NOT NULL ORDER BY date DESC LIMIT 1")
    .get() as { date: string } | undefined;

  let builtAt: string | null = null;
  try {
    const row = db
      .prepare("SELECT value FROM db_metadata WHERE key = 'built_at'")
      .get() as { value: string } | undefined;
    builtAt = row?.value ?? null;
  } catch {
    /* table may not exist on legacy DBs */
  }

  const today = new Date().toISOString().split("T")[0]!;

  // Read existing coverage.json so we preserve scope_statement, gaps, tools, etc.
  let existing: Partial<CoverageFile> = {};
  if (existsSync(COVERAGE_FILE)) {
    try {
      existing = JSON.parse(readFileSync(COVERAGE_FILE, "utf8")) as Partial<CoverageFile>;
    } catch {
      console.warn(`Could not parse existing ${COVERAGE_FILE}; regenerating from scratch.`);
    }
  }

  const mergedSources: CoverageSource[] =
    existing.sources && existing.sources.length > 0
      ? existing.sources.map((s) => ({
          ...s,
          item_count: totalRows,
          expected_items: s.expected_items ?? totalRows,
          last_fetched: today,
          last_refresh: today,
          last_verified: today,
          status: "current",
        }))
      : [
          {
            id: "sfda-regulations-portal",
            name: "SFDA Laws and Regulations",
            authority: "Saudi Food and Drug Authority (SFDA)",
            url: "https://sfda.gov.sa/en/regulations",
            item_count: totalRows,
            expected_items: totalRows,
            item_type: "publication",
            measurement_unit: "rows (frameworks + controls + circulars)",
            last_fetched: latestCircular?.date ?? today,
            last_refresh: today,
            last_verified: today,
            refresh_frequency: "monthly",
            update_frequency: "monthly",
            verification_method: "page_scraped",
            completeness: "partial",
            status: "current",
          },
        ];

  const coverage: CoverageFile = {
    schema_version: existing.schema_version ?? "1.0",
    mcp_name: existing.mcp_name ?? "saudi-sfda-regulation-mcp",
    mcp_type: existing.mcp_type ?? "compliance",
    coverage_type: existing.coverage_type ?? "regulatory_publications",
    coverage_date: today,
    database_version: existing.database_version ?? "0.1.0",
    scope_statement:
      existing.scope_statement ??
      "Saudi Food and Drug Authority (SFDA) public regulations and guidance.",
    scope_exclusions: existing.scope_exclusions ?? [],
    languages: existing.languages ?? ["en", "ar"],
    language_primary: existing.language_primary ?? "en",
    jurisdictions: existing.jurisdictions ?? ["Saudi Arabia"],
    sectors: existing.sectors ?? [],
    sources: mergedSources,
    gaps: existing.gaps ?? [],
    tools: existing.tools ?? [],
    totals: { frameworks, controls, circulars },
    summary: {
      total_tools: (existing.tools ?? []).length,
      total_sources: mergedSources.length,
      total_items: totalRows,
      known_gaps: (existing.gaps ?? []).length,
      gaps_planned: (existing.gaps ?? []).filter(
        (g) => (g as { planned?: boolean }).planned === true,
      ).length,
    },
    generatedAt: builtAt ?? new Date().toISOString(),
    // Legacy fields kept for backwards compat with any audit script that
    // reads them directly.
    mcp: existing.mcp_name ?? "saudi-sfda-regulation-mcp",
    version: existing.database_version ?? "0.1.0",
  };

  const dir = dirname(COVERAGE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(COVERAGE_FILE, JSON.stringify(coverage, null, 2) + "\n", "utf8");

  console.log(`Coverage updated: ${COVERAGE_FILE}`);
  console.log(`  Frameworks : ${frameworks}`);
  console.log(`  Controls   : ${controls}`);
  console.log(`  Circulars  : ${circulars}`);
  console.log(`  Total rows : ${totalRows}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
