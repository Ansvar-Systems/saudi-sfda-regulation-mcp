# Changelog

All notable changes to the Saudi SFDA Regulation MCP will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `sa_sfda_check_data_freshness` meta-tool reporting per-source staleness and database build date.
- `_error_type` on all error responses (`NO_MATCH`, `INVALID_INPUT`, `UNKNOWN_TOOL`, `INTERNAL_ERROR`).
- `db_metadata` table populated during `build:db` with `built_at`, `source`, `mcp_name`, `languages`, `language_primary`.
- `languages: ["en", "ar"]` and `language_primary: "en"` in every `_meta` envelope.
- Smoke tests (`tests/smoke.test.ts`) covering DB existence, `integrity_check`, `journal_mode=delete`, `db_metadata`, row counts, and FTS queries.
- Full golden-standard `data/coverage.json` (schema_version, scope_statement, scope_exclusions, gaps, tools, summary).
- `.dockerignore` to keep raw PDFs, tests, and dev-only files out of the image.
- Open-source docs: `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, `REGISTRY.md`.

### Changed

- `data_age` in `_meta` now reads `db_metadata.built_at` at runtime.
- `update-coverage.ts` now merges live counts into the existing golden-standard coverage.json instead of overwriting it with the minimal shape.
- Database is kept in `journal_mode=DELETE` after `build:db` (required for read-only WASM SQLite deploys).
- Runtime `getDb()` no longer switches to WAL on open.

### Fixed

- Dockerfile builder stage was missing `COPY server.json ./`, causing every GHCR build to fail with `lstat /app/server.json: no such file or directory`.

## [0.1.0] — 2026-04-14

### Added

- Initial Saudi SFDA MCP with 6 tools under the `sa_sfda_` prefix.
- Ingestion pipeline (`ingest:fetch`, `ingest:diff`, `build:db`, `coverage:update`, `freshness:check`).
- 152 rows ingested from https://sfda.gov.sa/en/regulations (40 frameworks, 40 controls, 72 circulars).
- Streamable HTTP transport (`dist/src/http-server.js`) and stdio transport (`dist/src/index.js`).
- Sample seed script for first-run container bootstrapping.
