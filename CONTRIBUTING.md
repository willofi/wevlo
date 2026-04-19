# Contributing

## Working Agreement

- Build vertical slices with one primary bounded-context owner.
- Write the smallest failing domain test first for new business rules.
- Keep adapters and framework wiring outside domain packages.
- Open contract-first PRs when multiple agents or packages depend on the same boundary.

## Definition Of Ready

- Problem statement and target user are clear.
- Acceptance criteria are testable.
- Owning bounded context is assigned.
- Dependencies and rollout constraints are visible.

## Definition Of Done

- Domain, application, and adapter tests cover the behavior.
- CI is green.
- Documentation or ADRs are updated when a durable decision changes.
- Observability and QA evidence are present for operationally meaningful changes.

## Branching

- Use short-lived branches.
- Prefer `feat/<context>-<slice>`, `fix/<context>-<bug>`, and `adr/<decision>`.
- Rebase early and keep `main` releasable.
