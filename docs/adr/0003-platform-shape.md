# ADR-0003: Platform Shape

## Status

Accepted

## Context

The product must run on web, desktop, and mobile without forcing one UI abstraction to fit every platform.

## Decision

Use Next.js App Router for web, Tauri for desktop with shared web UI, and Expo Router with native UI for mobile. Share domain logic, contracts, tokens, and headless behavior, but keep route trees and view implementations platform-specific where needed.

## Alternatives Considered

- Web-only plus PWA
- Electron instead of Tauri
- One UI library across web and native

## Consequences

- Web and desktop can move quickly together.
- Mobile remains native and avoids DOM leakage.
- More than one presentation layer must be maintained intentionally.
