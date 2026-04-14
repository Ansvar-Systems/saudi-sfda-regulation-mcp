# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities through **GitHub Security Advisories** — do not open a public issue.

Navigate to: **Security → Report a vulnerability** on the repository page.

We aim to acknowledge reports within 2 business days and to release a patch within 30 days for confirmed vulnerabilities.

## Scope

This MCP server is a read-only regulatory reference tool. It:
- Contains no authentication or user data
- Processes no personally identifiable information
- Makes read-only queries against a local SQLite database
- Accepts user search queries as input

Relevant security concerns include: dependency vulnerabilities, SQL injection via FTS5 queries, and denial-of-service via malformed queries.
