# Project Instructions

## Commands

- Install: `npm install`
- Typecheck: `npm run typecheck`
- Lint/format check: `npm run lint`
- Unit/property coverage: `npm run test:coverage`
- Build: `npm run build`
- Packed ESM/CJS/type smoke tests: `npm run test:package`
- Browser matrix: `npm run test:browser`
- Full local gate: `npm run check`

## Conventions

- Keep `dependencies` and `peerDependencies` empty.
- Keep semantic value kinds separate and use explicit function names.
- Validate exact structural records at every public boundary; never use value `instanceof` checks.
- Reject ambiguous correction by default. Add policy only through explicit options.
- Update nearby diagrams, README semantics, fixtures, and `qa-reports/test-plan.md` with behavior changes.
- Maintain 100% statements, branches, functions, and lines for runtime implementation modules.

## Notes

- IANA behavior is supplied by host `Intl`; results can vary by runtime tzdb version.
- `ZonedDateTime` stores only epoch milliseconds and a zone identifier. Never cache local fields.
- The Intl candidate algorithm is bounded and targets real host IANA transitions. Do not claim
  universal Temporal equivalence.
- ESM and CJS create separate class/cache instances. Stable error codes and `isDateTimeError` are the
  cross-build contract.

## Design System

Always read `DESIGN.md` before making visual or UI decisions. Font choices, colors, spacing, and the
site's aesthetic direction are defined there. Do not deviate without explicit user approval.

## Deploy Configuration (configured by /setup-deploy)

- Platform: GitHub Pages via GitHub Actions
- Production URL: https://erikleon.github.io/strictdatetime/
- Deploy workflow: `.github/workflows/pages.yml`
- Deploy status command: `gh run list --workflow pages.yml --limit 1`
- Merge method: direct push to `main`
- Project type: static documentation site and npm library
- Post-deploy health check: `https://erikleon.github.io/strictdatetime/`

### Custom deploy hooks

- Pre-merge: `npm run check`
- Deploy trigger: automatic on changes to `docs/` or the Pages workflow pushed to `main`
- Deploy status: poll the Pages workflow, then request the production URL
- Health check: `curl -fsS https://erikleon.github.io/strictdatetime/`
