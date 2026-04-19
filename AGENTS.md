# Repository Guidelines

This file is the repo-local entry point for AI working rules.

## Instruction Precedence

- Treat this file as the repo-local source of truth.
- Project-local instructions in this file override shared docs when they conflict.
- Use shared docs to extend these rules, not replace them.
- If a section below is still a placeholder, inspect the repository directly instead of guessing.

## Default Working Rules

Use these defaults unless project-local code clearly requires otherwise:

- Prefer readable code over clever code.
- Keep changes focused and avoid unrelated churn.
- Match the existing stack and code style unless it is clearly harmful.
- Validate assumptions at system boundaries and make failure paths easy to trace.
- Test the changed behavior at the cheapest reliable level first.
- Surface assumptions, risks, and trade-offs early.

## Shared Baseline

Use these shared docs by default when they are accessible:

- baseline: `~/.agent-kit/agents/core.md`
- coding: `~/.agent-kit/agents/coding.md`

## Task-Specific Shared Docs

Load these shared docs only when they match the task:

Do not load task-specific shared docs unless the current task requires them.
When gathering additional shared or repository context, start with the smallest relevant scope and avoid bulk-loading files or docs.

- frontend: `~/.agent-kit/agents/frontend.md` for React, Next.js App Router, or client-side state
- architecture: `~/.agent-kit/agents/architecture.md` for structure, boundaries, and large design changes
- review: `~/.agent-kit/prompts/review.md` for code review tasks
- refactor: `~/.agent-kit/prompts/refactor.md` for behavior-preserving cleanup
- debug: `~/.agent-kit/prompts/debug.md` for root-cause analysis
- naming: `~/.agent-kit/rules/naming.md` when naming quality materially affects the work
- git: `~/.agent-kit/rules/git.md` when commit or PR behavior matters

If shared docs are not accessible in the current environment, continue with the local rules here and ask for specific shared contents only when they materially affect the task.

## Project Structure And Ownership

<!-- Replace this section with repo-specific facts when they are known.
Keep the file usable even before customization: if details are missing, inspect the repository directly instead of guessing. -->

- Inspect the repository directly before assuming ownership, boundaries, or generated areas.
- Document fragile paths, generated files, or ownership boundaries here when they become clear.

## Build, Test, And Development Commands

<!-- Replace these with repo-specific commands when they are known.
Until then, discover commands from the repository itself rather than guessing. -->

- install: inspect the repo before choosing a command
- dev: inspect the repo before choosing a command
- build: inspect the repo before choosing a command
- lint: inspect the repo before choosing a command
- test: inspect the repo before choosing the cheapest reliable automated check
- minimum validation before submit: run the smallest reliable checks that cover the changed behavior
- if no reliable automated test exists, say so explicitly and describe the manual validation performed

## Local Conventions And Constraints

<!-- Replace this section with project-specific rules when they matter. -->

- If project-specific constraints are not documented yet, inspect the codebase and follow existing patterns rather than inventing new ones.
- Add architecture, compatibility, deployment, naming, typing, or layering constraints here when they become stable expectations.

## Review Notes

<!-- Replace this section with repo-specific review risks when they are known. -->

- Prioritize correctness, regression risk, and missing validation over style-only feedback.
- Add common failure modes, migration concerns, rollout checks, or release-sensitive areas here when they become clear.
