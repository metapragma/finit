# Finit

Finit is a visual design-review artifact that helps bridge the understanding gap between engineers and non-technical PMs, founders, and stakeholders.

This repository contains the MVP of a larger product. The MVP focuses on a single, canonical scenario to validate the narrative and interaction model. The long-term plan is to expand to multiple design-review scenarios that explain similar system trade-offs.

![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f)
[![CI](https://github.com/metapragma/finit/actions/workflows/ci.yml/badge.svg)](https://github.com/metapragma/finit/actions/workflows/ci.yml)

## What it does
- Turns engine output into a clear, replayable, visual narrative of load, prioritization, and trade-offs.
- Makes the engine’s reasoning legible without turning the UI into a simulator.
- Provides a shared mental model for stakeholders who don’t live in the codebase.

## Audience
- Engineering teams doing design reviews.
- PMs, founders, and stakeholders who need a clear, consistent explanation of system behavior under various conditions.

## MVP scope
- Exactly one canonical scenario:
  - User classes: `ANON`, `FREE`, `PAID`
  - Under load, finite capacity causes waiting; paid users receive priority scheduling
  - Shows: normal -> pressure -> capacity reached -> priority divergence -> explicit trade-off -> recovery
- The UI is a playback of Go engine output only (no simulation, no inference).

## Key features
- Visual workflow playback
- Engine-authored Review Log (human-readable narration derived from engine events)
- Deterministic replay (Replay ID/hash is visible and verifiable)
- Inspector mode (engine reasoning overlays)
- Go-first CLI to generate and replay run artifacts

## Quality checks
Run lint from the repo root:

```sh
make lint
```

Targeted lint:

```sh
make lint-go
make lint-ui
```

Tool versions are pinned in `.tool-versions`. If `golangci-lint` is not on your PATH,
`./scripts/lint-go.sh` will run the pinned version via `go run`.

Dependency audits:

```sh
make audit
```

## Formatting
Formatting is standardized in `.editorconfig`. UI formatting uses Prettier:

```sh
make format
```

To enforce formatting and linting before commits (staged files only), enable the pre-commit hook:

```sh
./scripts/install-hooks.sh
```

## Demo path
1. Press Play (normal load)
2. Switch to High Pressure (pressure + queueing)
3. Observe priority divergence (paid vs free vs anon)
4. Pause on trade-off moment (highlight one paid moving vs one free waiting)
5. Toggle Inspector to reveal engine reasoning overlays

## Roadmap
The long-term plan is to expand beyond the single scenario into related design-review scenarios (e.g., retries, rate limiting, background jobs). These are intentionally out of scope for the MVP.

## Releases
- `CHANGELOG.md` tracks notable changes.
- `RELEASE.md` documents the release process.

## License
MIT. See `LICENSE`.
