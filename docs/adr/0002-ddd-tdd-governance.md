# ADR-0002: DDD + TDD Delivery Governance

## Status

Accepted

## Context

The product has high-risk boundaries around permissions, imports, sync, and multi-platform clients. We need a delivery model that reduces regressions and keeps the domain model explainable.

## Decision

Adopt DDD with bounded contexts and TDD as the default delivery path. New domain behavior starts with a failing domain test, then moves outward into application and adapter tests.

## Alternatives Considered

- UI-first implementation with backfilled tests
- Service-layer-only testing

## Consequences

- The domain layer stays framework-free and easier to refactor.
- Delivery speed depends on disciplined small PRs and contract-first collaboration.
