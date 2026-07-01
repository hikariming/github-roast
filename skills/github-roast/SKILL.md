# GitHub Roast CLI

Use this skill when an agent needs to score or roast a public GitHub account
through the official GitHub Roast service.

The CLI is a remote wrapper around the website API. It does not run local
GitHub scanning, scoring, or LLM logic. Use it instead of importing project
internals.

## Default Service

The default host is:

```bash
https://ghfind.com
```

Override it for local development:

```bash
GITHUB_ROAST_HOST=http://localhost:3000
```

## Authentication

Production `/api/scan` requests need either a machine API key or a Turnstile
token. Prefer machine auth for agents:

```bash
GITHUB_ROAST_API_KEY=...
```

This is sent as:

```text
Authorization: Bearer <key>
```

The server still uses the same website endpoints:

```text
POST /api/scan
POST /api/roast
```

Do not call `/api/cli/*`; no separate CLI API exists.

## Discovery

Start by discovering commands:

```bash
pnpm github-roast commands --json
pnpm github-roast commands show roast --json
```

## Common Calls

Scan a user and return raw website scan JSON:

```bash
pnpm github-roast scan <username> -o json
```

Return only the deterministic scoring summary:

```bash
pnpm github-roast score <username> -o json
```

Generate a full report:

```bash
pnpm github-roast roast <username> --lang zh -o json
pnpm github-roast roast <username> --lang en -o markdown
```

Check local CLI credentials:

```bash
pnpm github-roast auth status -o json
```

## Agent Rules

- Prefer `-o json` for machine consumption.
- Use `--host http://localhost:3000` when testing an active local dev server.
- Do not pass GitHub tokens or LLM API keys to the CLI; those belong on the
  server.
- Do not reimplement scoring locally. The authoritative score comes from
  `POST /api/scan` and the final report from `POST /api/roast`.
