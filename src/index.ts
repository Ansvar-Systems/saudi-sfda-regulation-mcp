#!/usr/bin/env node

/**
 * Saudi SFDA MedTech Regulation MCP — stdio entry point.
 *
 * Provides MCP tools for querying Saudi Food and Drug Authority (SFDA)
 * medical device regulations, MDMA requirements, classification rules,
 * SaMD guidance, and MedTech compliance documents.
 *
 * Tool prefix: sa_sfda_
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  searchRegulations,
  searchControls,
  getControl,
  getCircular,
  listFrameworks,
  getStats,
  getDbMetadata,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkgVersion = "0.1.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  pkgVersion = pkg.version;
} catch {
  // fallback
}

let sourcesYml = "";
try {
  sourcesYml = readFileSync(join(__dirname, "..", "..", "sources.yml"), "utf8");
} catch {
  try {
    sourcesYml = readFileSync(join(__dirname, "..", "sources.yml"), "utf8");
  } catch {
    // fallback
  }
}

interface CoverageSource {
  name: string;
  url?: string;
  last_refresh?: string;
  last_fetched?: string;
  refresh_frequency?: string;
  update_frequency?: string;
  status?: string;
}
interface CoverageManifest {
  sources?: CoverageSource[];
  [key: string]: unknown;
}
function loadCoverage(): CoverageManifest | null {
  const candidates = [
    join(__dirname, "..", "..", "data", "coverage.json"),
    join(__dirname, "..", "data", "coverage.json"),
  ];
  for (const c of candidates) {
    try {
      return JSON.parse(readFileSync(c, "utf8")) as CoverageManifest;
    } catch {
      /* next */
    }
  }
  return null;
}

const SERVER_NAME = "saudi-sfda-regulation-mcp";

const DISCLAIMER =
  "This data is provided for informational reference only. It does not constitute legal or professional advice. " +
  "Always verify against official SFDA publications at https://sfda.gov.sa/en/regulations. " +
  "SFDA regulations are subject to change; confirm currency before reliance.";

const SOURCE_URL = "https://sfda.gov.sa/en/regulations";

// --- Tool definitions ---------------------------------------------------------

const TOOLS = [
  {
    name: "sa_sfda_search_regulations",
    description:
      "Full-text search across SFDA medical device regulations, requirements, and guidance documents. " +
      "Covers the Medical Device Interim Regulations, MDMA (Medical Device Marketing Authorization) Requirements, " +
      "Medical Device Classification Rules, SaMD guidance, IVD regulations, and Pharmacovigilance requirements " +
      "for medical device manufacturers and importers operating in Saudi Arabia. " +
      "Returns matching regulations and guidance with reference, title, domain, and summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'device registration', 'clinical investigation', 'post-market surveillance', 'SaMD classification')",
        },
        domain: {
          type: "string",
          description:
            "Filter by domain or category (e.g., 'Medical Device Registration', " +
            "'Classification', 'Post-Market Surveillance', 'In-Vitro Diagnostics'). Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sa_sfda_get_regulation",
    description:
      "Get a specific SFDA regulation or guidance document by its reference identifier. " +
      "For requirements use the requirement reference (e.g., 'SFDA-MDIR-2.1.1', 'SFDA-MDMA-3.2'). " +
      "For guidance documents use the document reference number (e.g., 'SFDA-GD-MD-001').",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "Requirement reference or guidance document reference number",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "sa_sfda_search_guidance",
    description:
      "Search SFDA medical device guidance documents specifically. Covers guidance across " +
      "registration, classification, labeling, post-market surveillance, in-vitro diagnostics, " +
      "Software as a Medical Device (SaMD), clinical investigation, and importation domains. " +
      "Returns guidance documents with their applicability scope and implementation notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query (e.g., 'labeling requirements', 'risk classification', " +
            "'post-market surveillance plan', 'software validation')",
        },
        framework: {
          type: "string",
          enum: ["sfda-mdir", "sfda-mdma", "sfda-mdcr"],
          description:
            "Filter by framework ID. sfda-mdir=Medical Device Interim Regulations, " +
            "sfda-mdma=MDMA Requirements, sfda-mdcr=Medical Device Classification Rules. Optional.",
        },
        domain: {
          type: "string",
          description:
            "Filter by domain (e.g., 'Registration', 'Classification', 'Labeling', " +
            "'Post-Market Surveillance'). Optional.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 10, max 50.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sa_sfda_list_frameworks",
    description:
      "List all SFDA regulatory frameworks and guidance series covered by this server, including version, " +
      "effective date, requirement count, and coverage domain. " +
      "Use this to understand what regulatory material is available before searching.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "sa_sfda_about",
    description:
      "Return metadata about this MCP server: version, data sources, coverage summary, " +
      "and list of available tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "sa_sfda_list_sources",
    description:
      "Return data provenance information: which SFDA sources are indexed, " +
      "how data is retrieved, update frequency, and licensing terms.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "sa_sfda_check_data_freshness",
    description:
      "Report data freshness: database build date, last refresh per source, " +
      "expected refresh frequency, and whether any source is stale.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// --- Zod schemas --------------------------------------------------------------

const SearchRegulationsArgs = z.object({
  query: z.string().min(1),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

const GetRegulationArgs = z.object({
  document_id: z.string().min(1),
});

const SearchGuidanceArgs = z.object({
  query: z.string().min(1),
  framework: z.enum(["sfda-mdir", "sfda-mdma", "sfda-mdcr"]).optional(),
  domain: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});

// --- Helpers ------------------------------------------------------------------

function textContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorContent(
  message: string,
  errorType:
    | "NO_MATCH"
    | "INVALID_INPUT"
    | "UNKNOWN_TOOL"
    | "INTERNAL_ERROR" = "INTERNAL_ERROR",
) {
  const body = { error: message, _error_type: errorType, _meta: buildMeta() };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
    isError: true as const,
  };
}

function getDataAge(): string {
  try {
    const meta = getDbMetadata();
    const builtAt = meta["built_at"];
    if (builtAt) return `Database built ${builtAt.split("T")[0]}`;
  } catch {
    /* fall through */
  }
  const cov = loadCoverage();
  const firstSource = cov?.sources?.[0];
  const last = firstSource?.last_refresh ?? firstSource?.last_fetched;
  if (last) return `Source last refreshed ${last}`;
  return "See data/coverage.json; refresh frequency: monthly";
}

function buildMeta(sourceUrl?: string): Record<string, unknown> {
  return {
    disclaimer: DISCLAIMER,
    data_age: getDataAge(),
    source_url: sourceUrl ?? SOURCE_URL,
    languages: ["en", "ar"],
    language_primary: "en",
  };
}

// --- Server -------------------------------------------------------------------

const server = new Server(
  { name: SERVER_NAME, version: pkgVersion },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "sa_sfda_search_regulations": {
        const parsed = SearchRegulationsArgs.parse(args);
        const results = searchRegulations({
          query: parsed.query,
          domain: parsed.domain,
          limit: parsed.limit ?? 10,
        });
        return textContent({
          results,
          count: results.length,
          _meta: buildMeta(),
        });
      }

      case "sa_sfda_get_regulation": {
        const parsed = GetRegulationArgs.parse(args);
        const docId = parsed.document_id;

        // Try control/requirement first
        const control = getControl(docId);
        if (control) {
          return textContent({
            ...control,
            _citation: {
              canonical_ref: control.control_ref,
              display_text: `SFDA — ${control.title} (${control.control_ref})`,
            },
            _meta: buildMeta(),
          });
        }

        // Try guidance document
        const circular = getCircular(docId);
        if (circular) {
          return textContent({
            ...circular,
            _citation: {
              canonical_ref: circular.reference,
              display_text: `SFDA — ${circular.title} (${circular.reference})`,
            },
            _meta: buildMeta(circular.pdf_url ?? SOURCE_URL),
          });
        }

        return errorContent(
          `No regulation or guidance document found with reference: ${docId}. ` +
            "Use sa_sfda_search_regulations to find available references.",
          "NO_MATCH",
        );
      }

      case "sa_sfda_search_guidance": {
        const parsed = SearchGuidanceArgs.parse(args);
        const results = searchControls({
          query: parsed.query,
          framework: parsed.framework,
          domain: parsed.domain,
          limit: parsed.limit ?? 10,
        });
        return textContent({
          results,
          count: results.length,
          _meta: buildMeta(),
        });
      }

      case "sa_sfda_list_frameworks": {
        const frameworks = listFrameworks();
        return textContent({
          frameworks,
          count: frameworks.length,
          _meta: buildMeta(),
        });
      }

      case "sa_sfda_about": {
        const stats = getStats();
        return textContent({
          name: SERVER_NAME,
          version: pkgVersion,
          description:
            "Saudi Food and Drug Authority (SFDA) Regulation MCP server. " +
            "Provides structured access to SFDA regulations and guidance across medical " +
            "devices, drugs, food safety, cosmetics, and feed safety for manufacturers, " +
            "importers, and compliance teams operating in Saudi Arabia.",
          data_source: "Saudi Food and Drug Authority (SFDA)",
          source_url: SOURCE_URL,
          coverage: {
            frameworks: `${stats.frameworks} SFDA regulatory frameworks`,
            requirements: `${stats.controls} regulatory requirements`,
            guidance_documents: `${stats.circulars} guidance and technical documents`,
            jurisdictions: ["Saudi Arabia"],
            sectors: [
              "Medical Devices",
              "IVD",
              "SaMD",
              "Drugs",
              "Food Safety",
              "Cosmetics",
              "Feed Safety",
            ],
          },
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
          _meta: buildMeta(),
        });
      }

      case "sa_sfda_list_sources": {
        const cov = loadCoverage();
        return textContent({
          sources_yml: sourcesYml,
          sources: cov?.sources ?? [],
          note: "Data is sourced from official SFDA public publications. See sources.yml and data/coverage.json for full provenance.",
          _meta: buildMeta(),
        });
      }

      case "sa_sfda_check_data_freshness": {
        const cov = loadCoverage();
        const dbMeta = (() => {
          try {
            return getDbMetadata();
          } catch {
            return {} as Record<string, string>;
          }
        })();
        const builtAt = dbMeta["built_at"] ?? null;
        const sources = (cov?.sources ?? []).map((s) => {
          const last = s.last_refresh ?? s.last_fetched ?? null;
          const freq = s.refresh_frequency ?? s.update_frequency ?? "unknown";
          let stale: boolean | null = null;
          let age_days: number | null = null;
          if (last) {
            const ageMs = Date.now() - new Date(last).getTime();
            if (!Number.isNaN(ageMs)) {
              age_days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
              const threshold =
                freq === "daily"
                  ? 2
                  : freq === "weekly"
                    ? 14
                    : freq === "monthly"
                      ? 45
                      : freq === "quarterly"
                        ? 120
                        : freq === "annual"
                          ? 400
                          : 90;
              stale = age_days > threshold;
            }
          }
          return {
            name: s.name,
            url: s.url ?? null,
            last_refresh: last,
            refresh_frequency: freq,
            status: s.status ?? (stale ? "stale" : "current"),
            age_days,
            stale,
          };
        });
        const anyStale = sources.some((s) => s.stale === true);
        return textContent({
          database_built_at: builtAt,
          sources,
          any_stale: anyStale,
          _meta: buildMeta(),
        });
      }

      default:
        return errorContent(`Unknown tool: ${name}`, "UNKNOWN_TOOL");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorType = err instanceof z.ZodError ? "INVALID_INPUT" : "INTERNAL_ERROR";
    return errorContent(`Error executing ${name}: ${message}`, errorType);
  }
});

// --- Start --------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} v${pkgVersion} running on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
