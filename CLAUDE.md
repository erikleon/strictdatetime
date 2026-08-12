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

## Releasing

The version in `package.json` drives the whole release. Bump it, merge to `main`, and
`.github/workflows/publish.yml` tags `vX.Y.Z`, opens a GitHub release with generated notes, and
publishes to npm. Do not create tags or releases by hand.

- Tagging and publishing share one workflow file deliberately. npm trusted publishing checks the
  top-level workflow filename against the publisher registered on npmjs.com, so splitting the
  publish step into a reusable workflow called from another file fails the OIDC exchange with a
  misleading `404`. The registered publisher must name `publish.yml`.
- Publishing is authenticated only by OIDC. There is no `NPM_TOKEN` fallback secret.
- The tag step is idempotent, and the publish job is gated on the version being absent from the
  registry rather than on the tag being new. A tagged but unpublished version therefore still
  publishes on a re-run, and unrelated `package.json` edits do nothing.
- A prerelease version (`1.2.0-rc.1`) is marked prerelease on GitHub and publishes under the npm
  `next` dist-tag, so `latest` stays on the last stable version.
- Run `gh workflow run publish.yml` to release the version already on `main`.

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
