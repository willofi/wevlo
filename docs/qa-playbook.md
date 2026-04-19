# QA Playbook

## Release Gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Replay fixtures updated when integration mapping changes
- Manual QA note for auth, permissions, or sync behavior

## Regression Priorities

1. Authorization and tenant isolation
2. Issue workflow transitions and source-of-truth policy
3. Import and webhook idempotency
4. Workspace and project visibility boundaries
5. Search and triage projections

## QA Agent Checklist

- Identify the riskiest boundary touched by the change.
- Require the smallest test that proves the boundary still holds.
- Add a permanent regression test or replay fixture for every confirmed bug.
- Block merges when evidence is missing for auth, sync, migration, or observability changes.
