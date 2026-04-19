# wevlo

Wevlo is a web-first issue hub prototype for a cross-platform issue workspace. The current prototype focuses on authenticated workspace collaboration, project-scoped issue tracking, and a Linear-inspired web surface for creating and reviewing issues.

## Current Product Surface

- `apps/web`: the primary alpha product surface
- `apps/api`: Fastify API for workspaces, projects, issues, collaboration, and auth context
- `packages/*`: bounded contexts, contracts, authz, data access, UI primitives, and test utilities
- `apps/desktop`, `apps/mobile`, `apps/worker`: present, but not part of the internal alpha operating surface yet

The current web prototype supports:

- Auth.js login with Google OAuth when configured
- Development fallback login when `ALLOW_DEV_AUTH=true`
- Workspace creation and project creation
- Issue list, board, drawer-based inspection, full-page issue detail, comments, and status transitions
- Workspace member invitations with shareable invite URLs
- Project-level access management by role on the existing admin routes

Still secondary or not part of the main prototype surface:

- Desktop and mobile parity
- Background worker processing beyond startup bootstrap
- GitHub, GitLab, or Slack live integrations
- Triage, advanced admin settings, and broader workflow customization

## Architecture

- `apps/*` hosts runtime applications: web, desktop, mobile, API, and worker.
- `packages/*` hosts bounded contexts, shared contracts, UI primitives, and test tooling.
- The backend is a modular monolith plus a worker, with DDD, TDD, contract-first APIs, and auditability as the default approach.
- The web app uses Auth.js plus a server-side BFF route family under `/api/bff/*` to forward authenticated requests into the API.

## Development Principles

- Start with domain tests and keep domain code framework-free.
- Keep dependency flow one-way: domain -> application -> infra -> apps.
- Use contract-first changes when work crosses package or bounded-context boundaries.
- Treat QA and observability as release requirements, not cleanup tasks.

## Quick Start

1. Copy environment defaults:

```bash
cp .env.example .env
```

Recommended local additions:

```env
NEXTAUTH_URL=http://localhost:3000
ALLOW_DEV_AUTH=true
```

2. Install dependencies:

```bash
pnpm install
```

3. Start Postgres and run migrations:

```bash
pnpm db:up
pnpm db:migrate
```

4. Start the API and web app in separate terminals:

```bash
pnpm --filter @wevlo/api dev
pnpm --filter @wevlo/web dev
```

5. Open the web app:

- Web: `http://localhost:3000`
- API: `http://127.0.0.1:4000`

## Login Modes

- Google OAuth is enabled only when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are configured.
- For local development and internal testing, demo identities are available when `ALLOW_DEV_AUTH=true`.
- The web app issues the session, and the BFF forwards authenticated user context to the API with internal auth headers.
- Set `NEXTAUTH_URL=http://localhost:3000` for local development to avoid Auth.js callback warnings.

## Validation Commands

Use these as the default alpha gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For the fuller operator flow, see [docs/internal-alpha-runbook.md](./docs/internal-alpha-runbook.md).
