# Saudi SFDA MedTech Regulation MCP

MCP server for querying Saudi Food and Drug Authority (SFDA) medical device regulations, MDMA requirements, classification rules, and MedTech guidance. Part of the [Ansvar](https://ansvar.eu) regulatory intelligence platform.

## What's Included

- **Medical Device Interim Regulations (MDIR)** — ~68 requirements covering device registration, authorised representative obligations, technical documentation, post-market surveillance, labeling, importation, and clinical investigation
- **Medical Device Marketing Authorization (MDMA) Requirements** — ~45 requirements for the GHAD submission process, clinical evidence standards, and accepted conformity certificates
- **Medical Device Classification Rules (MDCR)** — ~32 rules for risk class A-D determination, SaMD classification (IMDRF N12), and IVD classification (Class 1-4)
- **Guidance Documents** — ~8 guidance documents covering PMS, SaMD, clinical evaluation, IVD registration, labeling, establishment licensing, cybersecurity, and combination products

For full coverage details, see [COVERAGE.md](COVERAGE.md). For tool specifications, see [TOOLS.md](TOOLS.md).

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
| `sa_sfda_get_regulation` | Get a specific regulation or guidance document by reference ID |
| `sa_sfda_search_guidance` | Search guidance documents with optional framework/domain filters |
| `sa_sfda_list_frameworks` | List all SFDA frameworks with version and requirement counts |
| `sa_sfda_about` | Server metadata, version, and coverage summary |
| `sa_sfda_list_sources` | Data provenance: sources, retrieval method, licensing |

See [TOOLS.md](TOOLS.md) for parameters, return formats, and examples.

## Data Sources

All data is sourced from official SFDA public publications:

- [SFDA Medical Device Regulations Portal](https://sfda.gov.sa/en/regulations)
- [SFDA Medical Device Interim Regulations](https://sfda.gov.sa/en/regulations/medical-devices/medical-device-interim-regulations)

See [sources.yml](sources.yml) for full provenance details.

## Development

```bash
git clone https://github.com/Ansvar-Systems/saudi-sfda-regulation-mcp.git
cd saudi-sfda-regulation-mcp
npm install
npm run seed        # Create sample database
npm run build       # Compile TypeScript
npm test            # Run tests
npm run dev         # Start HTTP dev server
```

## Disclaimer

This server provides informational reference data only. It does not constitute legal or regulatory advice. Always verify against official SFDA publications. See [DISCLAIMER.md](DISCLAIMER.md) for full terms.

## License

[BSL-1.1](LICENSE) — Ansvar Systems AB. Converts to Apache-2.0 on 2030-04-13.
