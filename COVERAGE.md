# Coverage — Saudi SFDA Regulation MCP

> Last verified: 2026-04-14 | Database version: 0.1.0
> Regulatory domains: `healthcare/medical-devices`, `food-safety`, `pharmaceuticals`, `cosmetics`, `feed-safety` (Ansvar taxonomy)

## Source

Primary portal: https://sfda.gov.sa/en/regulations (Drupal-driven, 13 pages).
Bilingual: English and Arabic. English is the primary ingested locale; Arabic titles are attached when the Arabic portal serves the same PDF path.

## What's Included

Ingested by paginating the SFDA regulations listing and downloading every attached PDF (112 documents discovered, 111 fetched, 2 failed text extraction and kept as metadata-only records).

| Category | Items | Notes |
|----------|-------|-------|
| Food | 36 circulars + 12 frameworks | Food standards, commodity specifications, labeling, import/clearance |
| Drugs | 11 circulars + 11 frameworks | Marketing authorisation, GMP, pharmacovigilance, narcotics, veterinary |
| Medical Devices | 11 circulars + 2 frameworks | MDS-REQ 1..12 series, UDI, licensing, post-market surveillance, clinical trials |
| Authority / General | 7 circulars + 3 frameworks | Cross-cutting authority regulations, pilgrim clearance |
| Feed | 4 circulars + 4 frameworks | Feed factory/warehouse requirements, feed act |
| Cosmetics | 1 circular + 1 framework | Implementing regulation of cosmetic products law |
| General | 3 circulars + 2 frameworks | Other procedural rules |

**Total: 112 documents (40 frameworks, 40 controls, 72 circulars) — 152 rows across tables.**

Medical device requirement series covered in full:

| Reference | Title | Published |
|-----------|-------|-----------|
| MDS-REQ 1 | Medical Devices Marketing Authorization | 2021-12-19 |
| MDS-REQ 2 | Clinical Trials of Medical Devices | 2025-06-22 |
| MDS-REQ 3 | Safe Use of Medical Devices Inside Healthcare Facilities | 2023-07-25 |
| MDS-REQ 5 | Importation and Shipments Clearance | 2023-10-16 |
| MDS-REQ 6 | Technical and Clinical Specs of Medical Radioactive Materials | 2026-01-08 |
| MDS-REQ 7 | Unique Device Identification (UDI) | — (framework) |
| MDS-REQ 9 | Licensing of Medical Devices Establishments | 2022-08-18 |
| MDS-REQ 10 | Inspections and QMS for Medical Devices | 2026-01-11 |
| MDS-REQ 11 | Post-Market Surveillance | 2023-03-28 |
| MDS-REQ 12 | Transporting and Storage | 2026-01-11 |

## What's NOT Included

| Gap | Reason | Planned? |
|-----|--------|----------|
| SFDA enforcement actions / Warning Letters | Not on public regulations portal | No |
| SFDA inspection reports | Confidential | No |
| Draft guidance / consultation papers | Not yet in force | v2 |
| Arabic full-text content | Only Arabic titles attached where PDF path matches; EN text is primary | v2 |
| Per-article provision extraction | Full documents ingested as single rows; no heading-level provision split | v2 |

## Known Extraction Issues

| Document | Issue | Impact |
|----------|-------|--------|
| CUSTARD POWDER (CASTER-E-DS.pdf) | Corrupt PDF structure | Row present with title/URL; `full_text` empty |
| Halal Certification Issuing Requirements (HalalCertificationRequirements-en.docx) | DOCX served in PDF slot; pdf-parse rejected | Row present with title/URL; `full_text` empty |

Everything else extracted cleanly with no mojibake. A handful of files produced pdf.js informational warnings (`TT: undefined function: 32`, `Ignoring invalid character...`) but text content was captured correctly.

## Limitations

- SFDA publications are PDF-based; text extraction may miss formatting details and tables.
- Some guidance document versions may lag official SFDA releases by up to one month.
- Publication dates come from the portal listing (`.news-date`); they are ingestion/publication dates, not effective dates.
- SFDA may issue updated guidance without changing the document reference; always verify on the SFDA portal.

## Data Freshness

| Source | Refresh Schedule | Last Refresh | Next Expected |
|--------|-----------------|-------------|---------------|
| SFDA regulations portal | Monthly | 2026-04-14 | 2026-05-14 |

To check freshness programmatically, call the `sa_sfda_about` tool.
