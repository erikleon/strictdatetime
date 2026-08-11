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
