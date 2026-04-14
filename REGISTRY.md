# Registry Listing — Saudi SFDA Regulation MCP

Text for MCP registry listings (npm, Smithery, Glama, MCP catalog).

## Short description (≤ 140 chars)

Query Saudi SFDA medical device, food, drug, cosmetic, and feed regulations — 152 publications, citation-ready, with data-freshness reporting.

## Long description

The Saudi SFDA Regulation MCP gives AI agents and developers structured access
to the public regulatory corpus of the Saudi Food and Drug Authority. It covers
medical device regulations (MDS-REQ series, UDI, post-market surveillance,
clinical trials), drug and pharmacovigilance regulations, food safety
standards, cosmetics, and feed-safety rules — 152 rows drawn from the SFDA
Laws and Regulations portal at https://sfda.gov.sa/en/regulations.

Every response carries a `_meta` envelope with a liability disclaimer, database
build date, source URL, and language metadata (English primary, Arabic titles
attached where the Arabic portal serves the same PDF). Lookup responses include
`_citation` metadata so the Ansvar citation pipeline can render deterministic
inline links. Errors include `_error_type` (`NO_MATCH`, `INVALID_INPUT`,
`UNKNOWN_TOOL`, `INTERNAL_ERROR`) for precise handling.

## Tools

- `sa_sfda_search_regulations` — FTS5 search across all requirements and guidance.
- `sa_sfda_get_regulation` — Fetch one publication by reference.
- `sa_sfda_search_guidance` — FTS5 search restricted to controls with framework/domain filters.
- `sa_sfda_list_frameworks` — Enumerate SFDA regulatory frameworks.
- `sa_sfda_about` — Server version, coverage summary, tool list.
- `sa_sfda_list_sources` — Data provenance, retrieval method, licensing.
- `sa_sfda_check_data_freshness` — Database build date and per-source staleness.

## Install

```
npm install @ansvar/saudi-sfda-regulation-mcp
```

```
docker pull ghcr.io/ansvar-systems/saudi-sfda-regulation-mcp:latest
```

## Data

- Source: Saudi Food and Drug Authority — https://sfda.gov.sa/en/regulations
- Volume: 152 rows (40 frameworks, 40 controls, 72 circulars / guidance docs)
- Refresh: monthly (automated GitHub Actions ingest)
- Languages: English primary; Arabic titles attached where PDF paths match
- License: BSL-1.1 (converts to Apache-2.0 on 2030-04-13)

## Links

- Source: https://github.com/Ansvar-Systems/saudi-sfda-regulation-mcp
- Coverage: [COVERAGE.md](COVERAGE.md)
- Tools: [TOOLS.md](TOOLS.md)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
- Privacy: [PRIVACY.md](PRIVACY.md)

## Keywords

sfda, saudi-arabia, medical-devices, medtech, food-safety, drugs, cosmetics,
feed-safety, regulatory, compliance, mcp, model-context-protocol, ansvar
