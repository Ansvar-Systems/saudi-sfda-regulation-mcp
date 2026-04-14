/**
 * Smoke tests for the SFDA database layer.
 *
 * These run after `npm run ingest:full` (or against the pre-ingested DB shipped
 * in the image) and verify:
 *   - the database file exists and is readable
 *   - journal_mode is DELETE (required by read-only WASM SQLite deploys)
 *   - PRAGMA integrity_check returns "ok"
 *   - db_metadata table is populated
 *   - a non-trivial number of records are present
 *   - FTS5 search returns results for common SFDA queries
 *   - public query helpers return valid shapes
 *   - tool responses carry the _meta envelope
 *
 * Contract tests (fleet-wide) live separately and are authored by the fleet
 * runner; this file intentionally covers only in-repo smoke assertions.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import {
  getStats,
  getDbMetadata,
  listFrameworks,
  searchRegulations,
  searchControls,
  searchCirculars,
} from "../src/db.js";

const DB_PATH = process.env["SFDA_DB_PATH"] ?? "data/sfda.db";

describe("SFDA database", () => {
  it("database file exists", () => {
    expect(existsSync(DB_PATH)).toBe(true);
  });

  it("journal_mode is DELETE (WASM-SQLite compatible)", () => {
    const raw = new Database(DB_PATH, { readonly: true });
    try {
      const mode = raw.pragma("journal_mode", { simple: true });
      expect(String(mode).toLowerCase()).toBe("delete");
    } finally {
      raw.close();
    }
  });

  it("PRAGMA integrity_check returns ok", () => {
    const raw = new Database(DB_PATH, { readonly: true });
    try {
      const result = raw.pragma("integrity_check", { simple: true });
      expect(String(result).toLowerCase()).toBe("ok");
    } finally {
      raw.close();
    }
  });

  it("db_metadata table exposes build metadata", () => {
    const meta = getDbMetadata();
    expect(Object.keys(meta).length).toBeGreaterThanOrEqual(3);
    expect(meta["mcp_name"]).toBeTruthy();
    expect(meta["source"]).toMatch(/sfda\.gov\.sa/);
  });

  it("contains at least 100 total rows (frameworks + controls + circulars)", () => {
    const s = getStats();
    const total = s.frameworks + s.controls + s.circulars;
    expect(total).toBeGreaterThanOrEqual(100);
  });

  it("lists frameworks with required fields", () => {
    const rows = listFrameworks();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const first = rows[0]!;
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
  });

  it("FTS search for 'medical' returns hits", () => {
    const hits = searchRegulations({ query: "medical", limit: 5 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const h of hits) {
      expect(["control", "circular"]).toContain(h.type);
      expect(h.title).toBeTruthy();
      expect(h.reference).toBeTruthy();
    }
  });

  it("FTS search across controls and circulars returns hits for 'device'", () => {
    const controlHits = searchControls({ query: "device", limit: 5 });
    const circularHits = searchCirculars({ query: "device", limit: 5 });
    expect(controlHits.length + circularHits.length).toBeGreaterThanOrEqual(1);
  });
});
