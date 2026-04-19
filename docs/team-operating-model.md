# Team Operating Model

## Roles

- PM owns scope, acceptance criteria, sequencing, and release decisions.
- Planner owns dependency mapping and parallel slice design.
- Researcher owns unknowns, spikes, and external system constraints.
- Developers own bounded contexts and code quality.
- Reviewer owns boundary integrity, ADR discipline, and maintainability.
- QA owns regression confidence, replay fixtures, release gates, and exploratory validation.

## Rules

- One bounded context has one primary owner.
- Shared contracts change before shared implementations.
- Risky work lands behind feature flags or in small vertical slices.
- QA signs off on the changed behavior, not just green CI.
