# Internal Alpha Runbook

This runbook is for developers, QA, and operators preparing or rehearsing the current web-first prototype.

## Alpha Scope

In scope:

- Web login
- Workspace and project setup
- Issue create, update, transition, board, full-page detail, and comments
- Workspace member invitations via shareable invite URLs
- Project-level access control

Out of scope:

- Desktop and mobile parity
- Production SSO/SCIM
- GitHub, GitLab, and Slack live integrations
- Background worker-driven sync workflows

## Requirements

- Node `>=22`
- pnpm `>=10.33`
- Docker with Compose support
- Postgres exposed on `5432`

## Required Environment

Copy [.env.example](../.env.example) to `.env` and review at least these values:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `ALLOW_DEV_AUTH`
- `WEVLO_DEV_USER_ID`
- `WEVLO_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXTAUTH_URL`
- `WEVLO_INTERNAL_AUTH_TOKEN`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

Recommended defaults for internal alpha:

- `ALLOW_DEV_AUTH=true` for local fallback login
- Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` only when testing Google login
- Set `NEXTAUTH_URL=http://localhost:3000` for local development
- Keep `WEVLO_INTERNAL_AUTH_TOKEN` identical for web and API

## Bootstrap

1. Copy env:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Start Postgres:

```bash
pnpm db:up
```

4. Run migrations:

```bash
pnpm db:migrate
```

5. Start the API:

```bash
pnpm --filter @wevlo/api dev
```

6. Start the web app:

```bash
pnpm --filter @wevlo/web dev
```

## Login And Onboarding

- Preferred alpha path: Google OAuth when configured
- Fallback path: demo identities when `ALLOW_DEV_AUTH=true`
- Invite flow is `copy/share the generated invite URL`
- Current alpha does not send invitation emails automatically

## Manual Smoke Script

Run this in order before any internal alpha demo or handoff.

1. Open `/login` and sign in.
2. Open `/` and confirm the bootstrap surface loads.
3. Create a workspace if none exists.
4. Open the workspace overview.
5. Create a project.
6. Open the project issues page.
7. Create an issue.
8. Open the new issue detail page.
9. Edit title, description, priority, and assignee.
10. Transition the issue state.
11. Add a comment.
12. Open the board and confirm the issue appears in the correct column.
13. Open workspace members and create an invitation.
14. Open or share the generated `/invite/{token}` link.
15. Accept the invite with another signed-in account.
16. Confirm the invited user can open the workspace.
17. Open project access and grant a project role.
18. Confirm the invited user can access or is blocked from the project according to role.
19. Remove project access and confirm deep-link access is blocked afterward.

## Release Gate

Run all of these before calling the build ready for internal alpha:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Common Failure Points

- Postgres is not running, or `DATABASE_URL` points to the wrong host.
- `WEVLO_INTERNAL_AUTH_TOKEN` differs between web and API, which breaks authenticated BFF requests.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are missing, so Google login is unavailable.
- `NEXTAUTH_URL` is missing or wrong, so Auth.js callback URLs or warnings appear during local login.
- `ALLOW_DEV_AUTH=false` and Google OAuth is not configured, leaving no usable login path.
- `WEVLO_API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` points at the wrong API origin.
- An invite token is already accepted, revoked, or expired.
- A user has workspace membership but not project access, so issue or board routes return denied states.

## Troubleshooting Notes

- If `/api/bff/*` calls return `401`, confirm the web session exists and the internal auth token matches.
- If workspace or project pages show access warnings, verify membership first, then project role assignment.
- If Google login is expected but not visible, verify both Google env variables are set before starting the web app.
- If local testing needs to proceed without Google, keep `ALLOW_DEV_AUTH=true` and use a demo identity from the login screen.
