/**
 * Combined ingestion entry point.
 *
 * Orchestrates fetch → build-db → coverage update in sequence.
 * Equivalent to running: npm run ingest:full
 *
 * Usage:
 *   npx tsx scripts/ingest.ts
 *   npx tsx scripts/ingest.ts --dry-run
 *   npx tsx scripts/ingest.ts --force
 */

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const extraArgs = args.filter((a) => ["--dry-run", "--force"].includes(a));

function run(script: string): void {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(
    "npx",
    ["tsx", script, ...extraArgs],
    { stdio: "inherit", shell: false },
  );
  if (result.status !== 0) {
    console.error(`Script failed: ${script} (exit ${result.status ?? "unknown"})`);
    process.exit(result.status ?? 1);
  }
}

run("scripts/ingest-fetch.ts");
run("scripts/build-db.ts");
run("scripts/update-coverage.ts");

console.log("\nIngestion complete.");
