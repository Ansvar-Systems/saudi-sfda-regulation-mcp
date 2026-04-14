# Saudi SFDA Regulation MCP

MCP server for querying Saudi Food and Drug Authority (SFDA) regulations and guidance across medical devices, drugs, food safety, cosmetics, and feed safety. Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## What's Included

152 rows drawn from the public SFDA Laws and Regulations portal at [sfda.gov.sa/en/regulations](https://sfda.gov.sa/en/regulations): 40 regulatory frameworks, 40 control rows (one per framework), and 72 circulars and guidance documents (112 source PDFs ingested in total; 2 kept as metadata-only due to upstream file quality).

| Category | Rows | Coverage |
|----------|------|----------|
| Food | 12 frameworks + 36 circulars | Food standards, commodity specifications, labeling, import/clearance |
| Drugs | 11 frameworks + 11 circulars | Marketing authorisation, GMP, pharmacovigilance, narcotics, veterinary |
| Medical Devices | 2 frameworks + 11 circulars | MDS-REQ 1..12 series, UDI, licensing, post-market surveillance, clinical trials |
| Authority / General | 3 frameworks + 7 circulars | Cross-cutting authority regulations, pilgrim clearance |
| Feed | 4 frameworks + 4 circulars | Feed factory/warehouse requirements, feed act |
| Cosmetics | 1 framework + 1 circular | Implementing regulation of cosmetic products law |
| General | 2 frameworks + 3 circulars | Other procedural rules |

Languages: English primary; Arabic titles attached where the Arabic portal serves the same PDF path.

Full coverage details: [COVERAGE.md](COVERAGE.md). Tool reference: [TOOLS.md](TOOLS.md).

## Installation

### npm (stdio transport)

```bash
npm install @ansvar/saudi-sfda-regulation-mcp
```

### Docker (HTTP transport)

```bash
docker pull ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
docker run -p 9199:9199 ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
```

## Usage

### stdio (Claude Desktop, Cursor, etc.)

Add to your MCP client configuration:

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

### HTTP (Streamable HTTP)

```bash
docker run -p 9199:9199 ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
# Server available at http://localhost:9199/mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `sa_sfda_search_regulations` | Full-text search across SFDA regulations, requirements, and guidance |
| `sa_sfda_get_regulation` | Get a specific regulation or guidance document by reference |
| `sa_sfda_search_guidance` | Search controls with optional framework/domain filters |
| `sa_sfda_list_frameworks` | List all SFDA frameworks with domain and row counts |
| `sa_sfda_about` | Server metadata, version, and coverage summary |
| `sa_sfda_list_sources` | Data provenance: sources, retrieval method, licensing |
| `sa_sfda_check_data_freshness` | Database build date and per-source staleness report |

Every response carries a `_meta` envelope (disclaimer, data_age, source_url, languages). Lookup responses include `_citation` for the Ansvar citation pipeline. Errors carry `_error_type` (`NO_MATCH`, `INVALID_INPUT`, `UNKNOWN_TOOL`, `INTERNAL_ERROR`).

See [TOOLS.md](TOOLS.md) for parameters, return formats, and examples.

## Data Sources

All data is sourced from official SFDA public publications:

- [SFDA Laws and Regulations portal](https://sfda.gov.sa/en/regulations)

See [sources.yml](sources.yml) for full provenance and [data/coverage.json](data/coverage.json) for the machine-readable coverage manifest.

## Development

```bash
git clone https://github.com/Ansvar-Systems/saudi-sfda-regulation-mcp.git
cd saudi-sfda-regulation-mcp
npm install
npm run build       # Compile TypeScript
npm test            # Run smoke tests
npm run dev         # Start HTTP dev server

# Data refresh (optional, runs the full ingest pipeline):
npm run ingest:full
```

## Ingestion & Freshness

- `npm run ingest:fetch` — pull latest PDFs from the SFDA portal
- `npm run build:db` — parse PDFs into SQLite, build FTS5, set `journal_mode=DELETE`
- `npm run coverage:update` — regenerate `data/coverage.json` counts and timestamps
- `npm run freshness:check` — verify each source is within its refresh window

The `ingest.yml`, `check-freshness.yml`, `ci.yml`, `ghcr-build.yml`, `semgrep.yml`, `trivy.yml`, and `scorecard.yml` GitHub Actions run these on schedule and publish security results to GitHub code scanning.

## Disclaimer

This server provides informational reference data only. It does not constitute legal or regulatory advice. Always verify against official SFDA publications. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.

## License

[BSL-1.1](LICENSE) — Ansvar Systems AB. Converts to Apache-2.0 on 2030-04-13.
