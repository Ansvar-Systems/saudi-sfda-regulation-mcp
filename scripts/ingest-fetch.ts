/**
 * SFDA Ingestion Fetcher
 *
 * Fetches the SFDA regulations portal (Drupal-driven), paginates through all
 * pages, extracts regulation metadata (title, date, category, PDF URL) for
 * both English and Arabic locales, downloads the PDFs, and extracts text
 * content for database ingestion.
 *
 * Portal structure (Drupal 10):
 *   - Landing: https://sfda.gov.sa/en/regulations (page=0..12)
 *   - Each regulation: <article class="warning-item"> containing
 *       .news-date          — publication date
 *       .inn.cat.<type>      — category class (medical|drugs|food|fodder|authority|cosmetics)
 *       .m-c-title           — title (plain text)
 *       a.download-doc-link  — link to the PDF under /sites/default/files/...
 *
 * Usage:
 *   npx tsx scripts/ingest-fetch.ts
 *   npx tsx scripts/ingest-fetch.ts --dry-run     # list what would be fetched
 *   npx tsx scripts/ingest-fetch.ts --force        # re-download existing files
 *   npx tsx scripts/ingest-fetch.ts --limit 5      # fetch only first N documents
 */

import * as cheerio from "cheerio";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://sfda.gov.sa";
const PORTAL_PATH_EN = "/en/regulations";
const PORTAL_PATH_AR = "/ar/regulations";
const RAW_DIR = "data/raw";
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 2000;
const REQUEST_TIMEOUT_MS = 60_000;
const USER_AGENT = "Ansvar-MCP/1.0 (regulatory-data-ingestion; https://ansvar.eu)";

// Safety cap so a broken pager never causes runaway pagination.
const MAX_PAGES = 50;

// CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const fetchLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "999", 10) : 999;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentLink {
  title_en: string;
  title_ar: string;
  url: string; // absolute PDF URL
  pdfPath: string; // portal path /sites/default/files/...
  category: string;
  categorySlug: string; // medical|drugs|food|fodder|authority|cosmetics|general
  publishedAt: string; // YYYY-MM-DD (best-effort)
  filename: string;
  reference: string; // inferred reference (e.g., MDS-REQ10)
}

interface FetchedDocument {
  title_en: string;
  title_ar: string;
  url: string;
  category: string;
  categorySlug: string;
  publishedAt: string;
  reference: string;
  filename: string;
  text: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const backoff = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.error(
        `  Attempt ${attempt + 1}/${retries} failed for ${url}: ${lastError.message}. ` +
          `Retrying in ${backoff}ms...`,
      );
      if (attempt < retries - 1) await sleep(backoff);
    }
  }
  throw lastError ?? new Error(`All retries failed for ${url}`);
}

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(pdfBuffer);
    return data.text ?? "";
  } catch (err) {
    console.error(
      `  Warning: PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "";
  }
}

// ---------------------------------------------------------------------------
// Portal scraping
// ---------------------------------------------------------------------------

function extractCategorySlug($item: cheerio.Cheerio<any>): string {
  // Look at the first "inn cat <slug>" class on the category chips.
  const chip = $item.find(".custom-tags a.cat").first();
  const cls = chip.attr("class") ?? "";
  const match = cls.match(/\bcat\s+([a-zA-Z]+)/);
  return match?.[1]?.toLowerCase() ?? "general";
}

function categoryLabelForSlug(slug: string): string {
  switch (slug) {
    case "medical":
      return "Medical Devices";
    case "drugs":
      return "Drugs";
    case "food":
      return "Food";
    case "fodder":
      return "Feed";
    case "authority":
      return "Authority / General";
    case "cosmetics":
      return "Cosmetics";
    default:
      return "General";
  }
}

function inferReferenceFromTitle(title: string, filename: string): string {
  // Extract codes like "MDS-REQ10", "MDS-REQ 12", "MDS-REQ 6"
  const re = /\b(MDS[-\s]?REQ[-\s]?\d+[a-zA-Z]?|MDS[-\s]?G[-\s]?\d+|Drug[-\s]?\d+|SFDA[-\s]?[A-Z0-9-]+)\b/;
  const m = title.match(re) ?? filename.match(re);
  if (m) return m[0]!.replace(/\s+/g, "-").toUpperCase();
  // Fall back to a slug derived from the filename stem (stripped of locale suffix).
  const stem = filename.replace(/\.pdf$/i, "").replace(/_?\d+$/, "");
  return `SFDA-${stem.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}`;
}

async function parsePage(
  locale: "en" | "ar",
  page: number,
): Promise<Map<string, Partial<DocumentLink>>> {
  const url = `${BASE_URL}${locale === "en" ? PORTAL_PATH_EN : PORTAL_PATH_AR}?page=${page}`;
  console.log(`  Fetching ${locale} page ${page + 1}: ${url}`);
  const response = await fetchWithRetry(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const entries = new Map<string, Partial<DocumentLink>>();

  $("article.warning-item").each((_, el) => {
    const $item = $(el);
    const title = $item.find(".m-c-title").first().text().trim();
    const pdfHref = $item.find("a.download-doc-link").first().attr("href") ?? "";
    const dateText = $item.find(".news-date").first().text().trim();

    if (!title || !pdfHref) return;

    const pdfPath = pdfHref.startsWith("http")
      ? new URL(pdfHref).pathname + new URL(pdfHref).search
      : pdfHref;

    const key = pdfPath; // PDF path is our canonical dedup key across locales.

    if (locale === "en") {
      const categorySlug = extractCategorySlug($item);
      const absoluteUrl = pdfHref.startsWith("http") ? pdfHref : `${BASE_URL}${pdfHref}`;
      const filename = decodeURIComponent(basename(pdfPath.split("?")[0] ?? pdfPath));
      entries.set(key, {
        title_en: title,
        url: absoluteUrl,
        pdfPath,
        category: categoryLabelForSlug(categorySlug),
        categorySlug,
        publishedAt: dateText || "",
        filename,
      });
    } else {
      entries.set(key, { title_ar: title });
    }
  });

  return entries;
}

function detectLastPage(html: string): number {
  const $ = cheerio.load(html);
  const lastPager = $("li.pager__item--last a").first().attr("href") ?? "";
  const m = lastPager.match(/[?&]page=(\d+)/);
  if (m) return parseInt(m[1]!, 10);
  // If no "last page" link, infer from the highest numbered pager item we can see.
  let maxPage = 0;
  $("li.pager__item a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const mm = href.match(/[?&]page=(\d+)/);
    if (mm) maxPage = Math.max(maxPage, parseInt(mm[1]!, 10));
  });
  return maxPage;
}

async function scrapePortal(): Promise<DocumentLink[]> {
  // First, fetch the English landing page to discover total page count.
  const landingUrl = `${BASE_URL}${PORTAL_PATH_EN}`;
  console.log(`Discovering pagination at ${landingUrl}`);
  const landingResp = await fetchWithRetry(landingUrl);
  const landingHtml = await landingResp.text();
  const lastPage = Math.min(detectLastPage(landingHtml), MAX_PAGES);
  console.log(`  Detected ${lastPage + 1} pages to crawl (page=0..${lastPage})`);

  // Gather English entries keyed by PDF path.
  const merged = new Map<string, Partial<DocumentLink>>();

  // Seed with landing page results.
  const $0 = cheerio.load(landingHtml);
  $0("article.warning-item").each((_, el) => {
    const $item = $0(el);
    const title = $item.find(".m-c-title").first().text().trim();
    const pdfHref = $item.find("a.download-doc-link").first().attr("href") ?? "";
    const dateText = $item.find(".news-date").first().text().trim();
    if (!title || !pdfHref) return;
    const pdfPath = pdfHref.startsWith("http")
      ? new URL(pdfHref).pathname + new URL(pdfHref).search
      : pdfHref;
    const categorySlug = extractCategorySlug($item);
    const absoluteUrl = pdfHref.startsWith("http") ? pdfHref : `${BASE_URL}${pdfHref}`;
    const filename = decodeURIComponent(basename(pdfPath.split("?")[0] ?? pdfPath));
    merged.set(pdfPath, {
      title_en: title,
      url: absoluteUrl,
      pdfPath,
      category: categoryLabelForSlug(categorySlug),
      categorySlug,
      publishedAt: dateText || "",
      filename,
    });
  });

  // Paginate through remaining English pages.
  for (let p = 1; p <= lastPage; p++) {
    await sleep(RATE_LIMIT_MS);
    const pageEntries = await parsePage("en", p);
    for (const [k, v] of pageEntries) merged.set(k, { ...(merged.get(k) ?? {}), ...v });
  }

  // Now enrich with Arabic titles across matching PDF paths. The Arabic portal
  // serves different PDF URLs per locale, but medical-device PDFs often have an
  // "E" English suffix and a separate Arabic file — we only merge when the path
  // matches exactly. Non-matching Arabic entries are still captured separately.
  for (let p = 0; p <= lastPage; p++) {
    await sleep(RATE_LIMIT_MS);
    const pageEntries = await parsePage("ar", p);
    for (const [k, v] of pageEntries) {
      if (merged.has(k)) {
        merged.set(k, { ...(merged.get(k) ?? {}), ...v });
      }
      // Intentionally do NOT add AR-only entries as standalone — the English
      // portal is the authoritative source for this MCP (bilingual policy
      // prefers EN primary, AR secondary when available for the same doc).
    }
  }

  // Finalise entries: require an English title + URL; fill in derived fields.
  const result: DocumentLink[] = [];
  for (const v of merged.values()) {
    if (!v.title_en || !v.url || !v.pdfPath || !v.filename) continue;
    const title = v.title_en;
    const reference = inferReferenceFromTitle(title, v.filename);
    result.push({
      title_en: title,
      title_ar: v.title_ar ?? "",
      url: v.url,
      pdfPath: v.pdfPath,
      category: v.category ?? "General",
      categorySlug: v.categorySlug ?? "general",
      publishedAt: v.publishedAt ?? "",
      filename: v.filename,
      reference,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Created directory: ${RAW_DIR}`);
  }

  let documents = await scrapePortal();
  console.log(`\nDiscovered ${documents.length} regulations from SFDA portal`);

  // Report breakdown by category.
  const catCounts = new Map<string, number>();
  for (const d of documents) catCounts.set(d.category, (catCounts.get(d.category) ?? 0) + 1);
  for (const [cat, n] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${n}`);
  }

  if (documents.length > fetchLimit) {
    documents = documents.slice(0, fetchLimit);
    console.log(`\nLimiting to ${fetchLimit} documents`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would fetch:");
    for (const doc of documents) {
      console.log(
        `  [${doc.categorySlug}] ${doc.title_en}\n    PDF: ${doc.url}${doc.title_ar ? `\n    AR:  ${doc.title_ar}` : ""}`,
      );
    }
    return;
  }

  const fetched: FetchedDocument[] = [];
  let skipped = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;
    const destPath = join(RAW_DIR, doc.filename);
    const metaPath = join(RAW_DIR, `${doc.filename}.meta.json`);

    if (!force && existsSync(metaPath)) {
      console.log(`[${i + 1}/${documents.length}] Skipping (exists): ${doc.title_en}`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${documents.length}] Fetching: ${doc.title_en}`);
    console.log(`  URL: ${doc.url}`);

    try {
      const response = await fetchWithRetry(doc.url);
      const buffer = Buffer.from(await response.arrayBuffer());

      writeFileSync(destPath, buffer);
      console.log(`  Downloaded: ${buffer.length.toLocaleString()} bytes -> ${destPath}`);

      const text = await extractPdfText(buffer);
      console.log(`  Extracted text: ${text.length.toLocaleString()} chars`);

      const meta: FetchedDocument = {
        title_en: doc.title_en,
        title_ar: doc.title_ar,
        url: doc.url,
        category: doc.category,
        categorySlug: doc.categorySlug,
        publishedAt: doc.publishedAt,
        reference: doc.reference,
        filename: doc.filename,
        text,
        fetchedAt: new Date().toISOString(),
      };

      writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
      fetched.push(meta);
    } catch (err) {
      console.error(
        `  ERROR fetching ${doc.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (i < documents.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    total: documents.length,
    fetched: fetched.length,
    skipped,
    errors: documents.length - fetched.length - skipped,
    documents: fetched.map((d) => ({
      title_en: d.title_en,
      title_ar: d.title_ar,
      reference: d.reference,
      filename: d.filename,
      category: d.category,
      publishedAt: d.publishedAt,
      textLength: d.text.length,
    })),
  };

  writeFileSync(join(RAW_DIR, "fetch-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nFetch complete: ${fetched.length} fetched, ${skipped} skipped, ${summary.errors} errors`);
  console.log(`Summary written to ${join(RAW_DIR, "fetch-summary.json")}`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
