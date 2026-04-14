# Tools — Saudi SFDA MedTech Regulation MCP

All tools use the `sa_sfda_` prefix. Every response includes a `_meta` object with `disclaimer`, `data_age`, and `source_url`.

---

## sa_sfda_search_regulations

Full-text search across SFDA medical device regulations, requirements, and guidance documents.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., "device registration", "post-market surveillance") |
| `domain` | string | No | Filter by domain or category |
| `limit` | number | No | Max results (default 10, max 50) |

### Example Call

```json
{
  "name": "sa_sfda_search_regulations",
  "arguments": {
    "query": "post-market surveillance",
    "limit": 5
  }
}
```

### Example Response

```json
{
  "results": [
    {
      "type": "control",
      "control_ref": "SFDA-MDIR-3.1.1",
      "title": "Serious Incident Reporting",
      "domain": "Post-Market Surveillance",
      "framework": "sfda-mdir",
      "summary": "Manufacturers and authorised representatives must report all serious incidents..."
    }
  ],
  "count": 1,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://sfda.gov.sa/en/regulations"
  }
}
```

---

## sa_sfda_get_regulation

Get a specific SFDA regulation or guidance document by its reference identifier.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | string | Yes | Requirement reference (e.g., "SFDA-MDIR-3.1.1") or guidance reference (e.g., "SFDA-GD-MD-001") |

### Example Call

```json
{
  "name": "sa_sfda_get_regulation",
  "arguments": {
    "document_id": "SFDA-MDIR-3.1.1"
  }
}
```

### Example Response

```json
{
  "control_ref": "SFDA-MDIR-3.1.1",
  "title": "Serious Incident Reporting",
  "domain": "Post-Market Surveillance",
  "framework": "sfda-mdir",
  "description": "Manufacturers and authorised representatives must report all serious incidents...",
  "_citation": {
    "canonical_ref": "SFDA-MDIR-3.1.1",
    "display_text": "SFDA — Serious Incident Reporting (SFDA-MDIR-3.1.1)"
  },
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://sfda.gov.sa/en/regulations"
  }
}
```

Returns an error if the reference is not found, with a suggestion to use `sa_sfda_search_regulations`.

---

## sa_sfda_search_guidance

Search SFDA medical device guidance documents with optional framework and domain filters.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., "labeling requirements", "SaMD classification") |
| `framework` | string | No | Filter by framework: `sfda-mdir`, `sfda-mdma`, or `sfda-mdcr` |
| `domain` | string | No | Filter by domain |
| `limit` | number | No | Max results (default 10, max 50) |

### Example Call

```json
{
  "name": "sa_sfda_search_guidance",
  "arguments": {
    "query": "SaMD classification",
    "framework": "sfda-mdcr",
    "limit": 5
  }
}
```

### Example Response

```json
{
  "results": [
    {
      "control_ref": "SFDA-MDCR-2.1.1",
      "title": "Software as a Medical Device (SaMD) Classification",
      "domain": "Classification",
      "framework": "sfda-mdcr",
      "description": "SFDA classifies Software as a Medical Device using the IMDRF SaMD classification framework..."
    }
  ],
  "count": 1,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://sfda.gov.sa/en/regulations"
  }
}
```

---

## sa_sfda_list_frameworks

List all SFDA regulatory frameworks and guidance series covered by this server.

### Parameters

None.

### Example Call

```json
{
  "name": "sa_sfda_list_frameworks",
  "arguments": {}
}
```

### Example Response

```json
{
  "frameworks": [
    {
      "id": "sfda-mdir",
      "name": "Medical Device Interim Regulations",
      "version": "2019 (updated 2022)",
      "effective_date": "2019-05-01",
      "control_count": 68,
      "domain": "Medical Device Registration"
    },
    {
      "id": "sfda-mdma",
      "name": "Medical Device Marketing Authorization Requirements",
      "version": "2021",
      "effective_date": "2021-01-01",
      "control_count": 45,
      "domain": "Marketing Authorization"
    },
    {
      "id": "sfda-mdcr",
      "name": "Medical Device Classification Rules",
      "version": "2020",
      "effective_date": "2020-06-01",
      "control_count": 32,
      "domain": "Classification"
    }
  ],
  "count": 3,
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://sfda.gov.sa/en/regulations"
  }
}
```

---

## sa_sfda_about

Return metadata about this MCP server: version, data sources, coverage summary, and available tools.

### Parameters

None.

### Example Call

```json
{
  "name": "sa_sfda_about",
  "arguments": {}
}
```

### Example Response

```json
{
  "name": "saudi-sfda-regulation-mcp",
  "version": "0.1.0",
  "description": "Saudi Food and Drug Authority (SFDA) MedTech Regulation MCP server...",
  "data_source": "Saudi Food and Drug Authority (SFDA)",
  "source_url": "https://sfda.gov.sa/en/regulations",
  "coverage": {
    "frameworks": "3 SFDA regulatory frameworks",
    "requirements": "145 regulatory requirements",
    "guidance_documents": "8 guidance and technical documents",
    "jurisdictions": ["Saudi Arabia"],
    "sectors": ["Medical Devices", "IVD", "SaMD", "Combination Products"]
  },
  "tools": [
    { "name": "sa_sfda_search_regulations", "description": "..." },
    { "name": "sa_sfda_get_regulation", "description": "..." },
    { "name": "sa_sfda_search_guidance", "description": "..." },
    { "name": "sa_sfda_list_frameworks", "description": "..." },
    { "name": "sa_sfda_about", "description": "..." },
    { "name": "sa_sfda_list_sources", "description": "..." }
  ],
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://sfda.gov.sa/en/regulations"
  }
}
```

---

## sa_sfda_list_sources

Return data provenance information: which SFDA sources are indexed, retrieval method, update frequency, and licensing terms.

### Parameters

None.

### Example Call

```json
{
  "name": "sa_sfda_list_sources",
  "arguments": {}
}
```

### Example Response

```json
{
  "sources_yml": "schema_version: \"1.0\"\nmcp_name: \"Saudi SFDA MedTech Regulation MCP\"\n...",
  "note": "Data is sourced from official SFDA public publications. See sources.yml for full provenance.",
  "_meta": {
    "disclaimer": "This data is provided for informational reference only...",
    "data_age": "See coverage.json; refresh frequency: monthly",
    "source_url": "https://sfda.gov.sa/en/regulations"
  }
}
```
