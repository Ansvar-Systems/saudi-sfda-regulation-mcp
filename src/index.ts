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
  sourcesYml = readFileSync(join(__dirname, "..", "sources.yml"), "utf8");
} catch {
  // fallback
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

function errorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

function buildMeta(sourceUrl?: string): Record<string, unknown> {
  return {
    disclaimer: DISCLAIMER,
    data_age: "See coverage.json; refresh frequency: monthly",
    source_url: sourceUrl ?? SOURCE_URL,
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
            "Saudi Food and Drug Authority (SFDA) MedTech Regulation MCP server. " +
            "Provides structured access to SFDA medical device regulations, MDMA requirements, " +
            "classification rules, SaMD guidance, and MedTech compliance documents for " +
            "manufacturers and importers operating in Saudi Arabia.",
          data_source: "Saudi Food and Drug Authority (SFDA)",
          source_url: SOURCE_URL,
          coverage: {
            frameworks: `${stats.frameworks} SFDA regulatory frameworks`,
            requirements: `${stats.controls} regulatory requirements`,
            guidance_documents: `${stats.circulars} guidance and technical documents`,
            jurisdictions: ["Saudi Arabia"],
            sectors: ["Medical Devices", "IVD", "SaMD", "Combination Products"],
          },
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
          _meta: buildMeta(),
        });
      }

      case "sa_sfda_list_sources": {
        return textContent({
          sources_yml: sourcesYml,
          note: "Data is sourced from official SFDA public publications. See sources.yml for full provenance.",
          _meta: buildMeta(),
        });
      }

      default:
        return errorContent(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorContent(
      `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`,
    );
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
