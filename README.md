# Saudi SFDA Regulation MCP

> Structured access to Saudi Food and Drug Authority (SFDA) regulations and guidance across medical devices, drugs, food safety, cosmetics, and feed safety with full-text search over PDF-derived content.

[![npm](https://img.shields.io/npm/v/@ansvar/saudi-sfda-regulation-mcp)](https://www.npmjs.com/package/@ansvar/saudi-sfda-regulation-mcp)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/saudi-sfda-regulation-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/saudi-sfda-regulation-mcp/actions/workflows/ci.yml)

Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## Quick Start

### Remote (Hetzner)

Use the hosted endpoint — no installation needed:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "saudi-sfda-regulation": {
      "url": "https://mcp.ansvar.eu/sa/sfda-regulation/mcp"
    }
  }
}
```

**Cursor / VS Code** (`.cursor/mcp.json` or `.vscode/mcp.json`):
```json
{
  "servers": {
    "saudi-sfda-regulation": {
      "url": "https://mcp.ansvar.eu/sa/sfda-regulation/mcp"
    }
  }
}
```

### Local (npm)

Run entirely on your machine:

```bash
npx @ansvar/saudi-sfda-regulation-mcp
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "saudi-sfda-regulation": {
      "command": "npx",
      "args": ["-y", "@ansvar/saudi-sfda-regulation-mcp"]
    }
  }
}
```

### Docker

```bash
docker pull ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
docker run -p 9199:9199 ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
```

The Docker image uses Streamable HTTP transport on port 9199 at `/mcp`. Health probe at `/health`.

## What's Included

152 rows drawn from the public SFDA Laws and Regulations portal at [sfda.gov.sa/en/regulations](https://sfda.gov.sa/en/regulations): **40 regulatory frameworks**, 40 control rows (one per framework), and **72 circulars and guidance documents**. 112 source PDFs were ingested in total; 2 are retained as metadata-only due to upstream file quality (1 corrupt PDF, 1 DOCX served in a PDF slot).

| Domain | Frameworks | Circulars | Coverage |
|--------|-----------:|----------:|----------|
| Food | 12 | 36 | Food standards, commodity specifications, labeling, import/clearance, pesticide residues, veterinary-drug residues, infant formula |
| Drugs | 14 | 11 | Marketing authorisation, GMP/GSDP, pharmacovigilance, narcotics, pricing, IND/clinical trials, veterinary |
| Medical Devices | 2 | 11 | MDS-REQ 1–12 series, UDI, licensing, post-market surveillance, clinical trials |
| Authority / General | 4 | 7 | Cross-cutting authority regulations, pilgrim clearance, CAB designation, cosmetics notification |
| Feed | 4 | 4 | Feed Act, factory/warehouse requirements, product registration, penalties table |
| Cosmetics | 2 | 1 | Private-laboratory licensing, quality manual |
| General | 2 | 3 | GCC Pesticides Law, procedural rules |

Languages: English primary; Arabic titles attached where the Arabic portal serves the same PDF path. Arabic body text and per-provision extraction are out of scope for v0.1.0 (see gaps below).

**Totals:** 40 frameworks, 40 control rows, 72 circulars = 152 rows.

Full coverage details: [COVERAGE.md](COVERAGE.md). Machine-readable manifest: [data/coverage.json](data/coverage.json). Tool reference: [TOOLS.md](TOOLS.md).

## What's NOT Included

- SFDA enforcement actions and warning letters (not published on the regulations portal)
- SFDA inspection reports (confidential)
- Draft guidance and public consultation papers (not yet in force)
- Arabic full-text body content — only Arabic titles are attached where PDF paths match (planned for 0.2.0)
- Per-article / per-clause provision extraction — documents are ingested as whole rows (planned for 0.2.0)
- SFDA fee schedules, tariff tables, and licence-application forms (not in scope for a regulations MCP)
- Two documents retained as metadata-only: one corrupt PDF, one DOCX served at a PDF URL — titles and source URLs preserved for discoverability

See [COVERAGE.md](COVERAGE.md) for the full gap list.

## Installation

### npm (stdio transport)

```bash
npm install @ansvar/saudi-sfda-regulation-mcp
```

Claude Desktop / Cursor / VS Code configuration:

```json
{
  "mcpServers": {
    "saudi-sfda-regulation": {
      "command": "npx",
      "args": ["-y", "@ansvar/saudi-sfda-regulation-mcp"]
    }
  }
}
```

### Docker (HTTP transport)

```bash
docker pull ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
docker run -p 9199:9199 ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
# MCP endpoint: http://localhost:9199/mcp
# Health:       http://localhost:9199/health
```

### Hosted

- Public MCP: https://mcp.ansvar.eu/sa/sfda-regulation
- Gateway (OAuth, multi-MCP): https://gateway.ansvar.eu

## Tools

All tools use the `sa_sfda_` prefix. Every response carries a `_meta` envelope (disclaimer, data_age, source_url, languages). Lookup and search responses include `_citation` for the Ansvar citation pipeline. Error responses carry `_error_type` (`NO_MATCH` | `INVALID_INPUT` | `UNKNOWN_TOOL` | `INTERNAL_ERROR`).

| Tool | Description |
|------|-------------|
| `sa_sfda_search_regulations` | Full-text search across SFDA regulations, requirements, and guidance documents |
| `sa_sfda_get_regulation` | Retrieve a specific regulation or guidance document by reference ID |
| `sa_sfda_search_guidance` | Search SFDA guidance documents with framework/domain filters |
| `sa_sfda_list_frameworks` | List all SFDA regulatory frameworks and guidance series with domain and row counts |
| `sa_sfda_about` | Server metadata, version, coverage summary, and tool list |
| `sa_sfda_list_sources` | Data provenance: sources, retrieval method, update frequency, licensing |
| `sa_sfda_check_data_freshness` | Database build date and per-source staleness report from `data/coverage.json` |

See [TOOLS.md](TOOLS.md) for parameter tables, return formats, and examples.

## Example Queries

```
# Find medical-device UDI guidance
sa_sfda_search_regulations("unique device identification UDI", domain="Medical Devices")

# Look up the Implementing Regulation of the Law of Medical Devices
sa_sfda_get_regulation("sfda-sfda-mdsysexce")

# Search drug GMP guidance
sa_sfda_search_guidance("good manufacturing practice", domain="Drugs")

# List every SFDA framework indexed
sa_sfda_list_frameworks()

# Check freshness (last_verified, refresh frequency)
sa_sfda_check_data_freshness()
```

## Development

```bash
git clone https://github.com/Ansvar-Systems/saudi-sfda-regulation-mcp.git
cd saudi-sfda-regulation-mcp
npm install
npm run build        # compile TypeScript
npm test             # run Vitest smoke suite
npm run dev          # HTTP dev server with hot reload (port 9199)
```

### Data refresh (full ingest pipeline)

```bash
npm run ingest:fetch    # pull PDFs from the SFDA portal
npm run build:db        # parse PDFs into SQLite, build FTS5, set journal_mode=DELETE
npm run coverage:update # regenerate data/coverage.json counts and timestamps
npm run freshness:check # verify each source is within its refresh window
npm run ingest:full     # run the three steps above in order
```

Scheduled workflows (`ci.yml`, `ingest.yml`, `check-freshness.yml`, `ghcr-build.yml`, `semgrep.yml`, `trivy.yml`, `scorecard.yml`) run these in GitHub Actions and publish security findings to GitHub code scanning.

Branching: `feature/* -> dev -> main`. Direct pushes to `main` are blocked by branch protection. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

## Authority

**Saudi Food and Drug Authority (SFDA)**
Kingdom of Saudi Arabia.
https://sfda.gov.sa

The SFDA regulates food, drugs, medical devices, cosmetics, and animal feed in Saudi Arabia. Its implementing regulations — including the Law of Medical Devices, the Law of Pharmaceutical and Herbal Establishments, the Feed Act, and the Cosmetic Products Law — are mandatory for all manufacturers, importers, distributors, and retailers supplying the Saudi market.

## License

BSL-1.1. See [LICENSE](LICENSE). Converts to Apache-2.0 on 2030-04-13.

## Disclaimer

This server provides informational reference data only. It does not constitute legal, regulatory, medical, or professional advice. The Arabic text of SFDA publications is the authoritative regulatory version; the English PDFs indexed here are secondary references. Always verify against the official SFDA portal and engage qualified regulatory-affairs, legal, and clinical professionals for product-registration or compliance decisions. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.
