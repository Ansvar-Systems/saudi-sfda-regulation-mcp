/**
 * Staleness checker for SAMA data sources.
 *
 * Reads data/coverage.json and checks each source against its expected
 * refresh frequency. Writes:
 *   data/.freshness-report  — JSON report with staleness details
 *   data/.freshness-stale   — "true" if any source is stale, "false" otherwise
 *
 * Exit codes:
 *   0 — all sources current
 *   1 — fatal error
 *   2 — one or more sources stale (also writes .freshness-stale=true)
 *
 * Usage:
 *   npx tsx scripts/check-freshness.ts
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const COVERAGE_FILE = "data/coverage.json";
const REPORT_FILE = "data/.freshness-report";
const STALE_FILE = "data/.freshness-stale";

interface CoverageSource {
  name: string;
  url: string;
  last_fetched: string | null;
  update_frequency: string;
  item_count: number;
  status: string;
}

interface CoverageFile {
  generatedAt: string;
  mcp: string;
  sources: CoverageSource[];
  totals: { frameworks: number; controls: number; circulars: number };
}

type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annually";

const FREQUENCY_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
  quarterly: 92,
  annually: 365,
};

function frequencyToDays(freq: string): number {
  return FREQUENCY_DAYS[freq.toLowerCase() as Frequency] ?? 92;
}

interface SourceReport {
  name: string;
  url: string;
  last_fetched: string | null;
  update_frequency: string;
  max_age_days: number;
  age_days: number | null;
  stale: boolean;
  reason: string;
}

async function main(): Promise<void> {
  if (!existsSync(COVERAGE_FILE)) {
    const report = {
      checkedAt: new Date().toISOString(),
      stale: true,
      reason: "coverage.json not found",
      sources: [],
    };
    writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
    writeFileSync(STALE_FILE, "true", "utf8");
    console.error("coverage.json not found. Run: npm run coverage:update");
    process.exit(2);
  }

  const coverage: CoverageFile = JSON.parse(readFileSync(COVERAGE_FILE, "utf8"));
  const now = Date.now();
  const sourceReports: SourceReport[] = [];
  let anyStale = false;

  for (const source of coverage.sources) {
    const maxAgeDays = frequencyToDays(source.update_frequency);
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    let ageDays: number | null = null;
    let stale = false;
    let reason = "current";

    if (source.last_fetched === null) {
      stale = true;
      reason = "never fetched";
    } else {
      const lastFetchedMs = new Date(source.last_fetched).getTime();
      if (isNaN(lastFetchedMs)) {
        stale = true;
        reason = "invalid last_fetched date";
      } else {
        ageDays = Math.floor((now - lastFetchedMs) / (24 * 60 * 60 * 1000));
        if (ageDays > maxAgeDays) {
          stale = true;
          reason = `last fetched ${ageDays} days ago (max ${maxAgeDays} for ${source.update_frequency})`;
        }
      }
    }

    if (source.item_count === 0) {
      stale = true;
      reason = "item_count is 0 — database may be empty";
    }

    if (stale) anyStale = true;

    sourceReports.push({
      name: source.name,
      url: source.url,
      last_fetched: source.last_fetched,
      update_frequency: source.update_frequency,
      max_age_days: maxAgeDays,
      age_days: ageDays,
      stale,
      reason,
    });
  }

  const report = {
    checkedAt: new Date().toISOString(),
    stale: anyStale,
    coverageGeneratedAt: coverage.generatedAt,
    totals: coverage.totals,
    sources: sourceReports,
  };

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(STALE_FILE, anyStale ? "true" : "false", "utf8");

  for (const s of sourceReports) {
    const indicator = s.stale ? "STALE" : "OK";
    const age = s.age_days !== null ? `${s.age_days}d old` : "never fetched";
    console.log(`[${indicator}] ${s.name} — ${age} — ${s.reason}`);
  }

  if (anyStale) {
    console.error("\nOne or more sources are stale. Run: npm run ingest:full");
    process.exit(2);
  } else {
    console.log("\nAll sources are current.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
