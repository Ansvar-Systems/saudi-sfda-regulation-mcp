/**
 * Change detection for SAMA ingestion pipeline.
 *
 * Computes SHA-256 hashes of fetched documents and compares against
 * the stored .source-hashes.json. Writes:
 *   data/.ingest-changed  — "true" or "false"
 *   data/.ingest-summary  — JSON summary of changes
 *
 * Usage:
 *   npx tsx scripts/ingest-diff.ts
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const RAW_DIR = "data/raw";
const HASHES_FILE = "data/.source-hashes.json";
const CHANGED_FILE = "data/.ingest-changed";
const SUMMARY_FILE = "data/.ingest-summary";

interface HashStore {
  generatedAt: string;
  hashes: Record<string, string>;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
    writeFileSync(CHANGED_FILE, "false", "utf8");
    writeFileSync(SUMMARY_FILE, JSON.stringify({ changed: false, reason: "no raw data", new: [], modified: [], removed: [] }, null, 2), "utf8");
    console.log("No raw data directory found. No changes.");
    return;
  }

  // Load existing hashes
  const existingStore: HashStore = existsSync(HASHES_FILE)
    ? (JSON.parse(readFileSync(HASHES_FILE, "utf8")) as HashStore)
    : { generatedAt: "", hashes: {} };

  const existingHashes = existingStore.hashes;

  // Compute hashes for current .meta.json files
  const metaFiles = readdirSync(RAW_DIR).filter((f) => f.endsWith(".meta.json")).sort();

  const currentHashes: Record<string, string> = {};
  for (const f of metaFiles) {
    const content = readFileSync(join(RAW_DIR, f));
    currentHashes[f] = sha256(content);
  }

  // Diff
  const newFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const removedFiles: string[] = [];

  for (const [f, hash] of Object.entries(currentHashes)) {
    if (!(f in existingHashes)) {
      newFiles.push(f);
    } else if (existingHashes[f] !== hash) {
      modifiedFiles.push(f);
    }
  }

  for (const f of Object.keys(existingHashes)) {
    if (!(f in currentHashes)) {
      removedFiles.push(f);
    }
  }

  const hasChanges = newFiles.length > 0 || modifiedFiles.length > 0 || removedFiles.length > 0;

  // Write output files
  writeFileSync(CHANGED_FILE, hasChanges ? "true" : "false", "utf8");

  const summary = {
    generatedAt: new Date().toISOString(),
    changed: hasChanges,
    new: newFiles,
    modified: modifiedFiles,
    removed: removedFiles,
    total: metaFiles.length,
  };
  writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf8");

  // Update stored hashes
  const newStore: HashStore = { generatedAt: new Date().toISOString(), hashes: currentHashes };
  writeFileSync(HASHES_FILE, JSON.stringify(newStore, null, 2), "utf8");

  if (hasChanges) {
    console.log(`Changes detected:`);
    if (newFiles.length > 0) console.log(`  New: ${newFiles.join(", ")}`);
    if (modifiedFiles.length > 0) console.log(`  Modified: ${modifiedFiles.join(", ")}`);
    if (removedFiles.length > 0) console.log(`  Removed: ${removedFiles.join(", ")}`);
  } else {
    console.log("No changes detected.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
