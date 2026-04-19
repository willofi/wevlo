# ADR-0001: Turborepo Monorepo Foundation

## Status

Accepted

## Context

The product needs shared domain logic and contracts across web, desktop, mobile, API, and worker surfaces while keeping one bounded-context owner per slice.

## Decision

Use a `pnpm` workspace orchestrated by Turborepo. Model backend code as a modular monolith plus a worker, and keep shared domain logic in packages with one-way dependency flow.

## Alternatives Considered

- Multiple repositories per platform
- Microservices at project inception

## Consequences

- Shared contracts and test tooling stay close to implementation.
- CI and dependency management stay simpler during product discovery.
- Boundary discipline must be enforced through package structure, reviews, and CODEOWNERS.
