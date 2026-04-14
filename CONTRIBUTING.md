# Contributing

Thanks for looking at the Saudi SFDA Regulation MCP. This repo is maintained by
Ansvar Systems AB as part of the Ansvar regulatory intelligence platform.

## Before you open a PR

- Run the full test suite: `npm run build && npm test`
- Keep the public tool surface stable — tool names, argument shapes, and the
  `_meta` envelope are part of the fleet contract tests.
- Match the existing code style (TypeScript `strict` mode, no `any`, no
  fallbacks that hide upstream errors).
- Follow [ADR-009 Anti-Slop](https://github.com/Ansvar-Systems/Ansvar-Architecture-Documentation/blob/main/docs/adr/ADR-009-anti-slop-standard.md) in README, tool descriptions, error messages, and commit text. No banned words, no filler preambles, no marketing language.

## Branches

- `main` is protected. All changes land via PR from `dev` or a feature branch.
- Direct pushes to `main` are rejected.

## Data changes

Never edit `data/sfda.db` by hand. Run the ingestion pipeline end-to-end:

```bash
npm run ingest:full
```

This runs `ingest:fetch`, `build:db`, and `coverage:update`. Commit the
resulting `data/sfda.db`, `data/coverage.json`, and `COVERAGE.md` together.

## Reporting issues

- Factual errors in returned data: file an issue with the `document_id` (or
  control_ref / circular reference) plus a link to the authoritative SFDA
  source.
- Security findings: see [SECURITY.md](SECURITY.md).

## License

By submitting a pull request you agree your contribution is licensed under
[BSL-1.1](LICENSE) and will convert to Apache-2.0 on 2030-04-13 per the
Additional Use Grant.
