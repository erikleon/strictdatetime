# strictdatetime

Strict, immutable date and time utilities for JavaScript and TypeScript with zero runtime dependencies.

[Documentation](https://erikleon.github.io/strictdatetime/) · [npm](https://www.npmjs.com/package/strictdatetime)

```bash
npm install strictdatetime
```

```ts
import {
  addCalendarToZonedDateTime,
  createCalendarDuration,
  parsePlainDateTime,
  resolveZonedDateTime,
  toZonedDateTimeString,
} from "strictdatetime";

const meeting = resolveZonedDateTime(
  parsePlainDateTime("2026-03-07T12:00:00.000"),
  "America/New_York",
);
const tomorrow = addCalendarToZonedDateTime(
  meeting,
  createCalendarDuration({ years: 0, months: 0, weeks: 0, days: 1 }),
);

toZonedDateTimeString(tomorrow);
// 2026-03-08T12:00:00.000-04:00[America/New_York]
```

## Design

- Pure named functions and frozen structural records.
- Separate exact elapsed-time and calendar wall-time arithmetic.
- Strict typed parsers. Native `Date.parse` strings are never accepted implicitly.
- Millisecond precision; non-zero finer precision is rejected.
- IANA zones through the host runtime's `Intl` data, plus fixed-offset zones.
- ESM and CommonJS builds with shared TypeScript declarations.
- No runtime or peer dependencies.

## Values

The public records are `Instant`, `PlainDate`, `PlainTime`, `PlainDateTime`, `ZonedDateTime`,
`ExactDuration`, and `CalendarDuration`. Every function validates exact enumerable keys. Runtime
identity, prototypes, and `instanceof` are not used for values.

`ZonedDateTime` stores only an epoch millisecond and a zone identifier. Local fields and offsets are
derived from current host time-zone data.

## Parsing profiles

- `parseInstant`: uppercase RFC 3339-style ISO timestamp with `Z` or a numeric offset.
- `parsePlainDate`, `parsePlainTime`, `parsePlainDateTime`: ISO calendar fields without a zone.
- `parseZonedDateTime`: ISO date-time, required numeric offset, and exactly one `[IANA/Zone]` or
  fixed-offset annotation.

The zoned grammar is an intentional RFC 9557 subset. Calendar, critical, unknown, and duplicate
annotations are rejected. Leap seconds and `24:00` are not supported.

## Time-zone behavior

Ambiguous times, nonexistent times, calendar overflow, and offset mismatch reject by default.
Callers may explicitly select Temporal-aligned policy names such as `earlier`, `later`, `compatible`,
or `constrain`.

Named-zone operations support years 1970–9999. Plain, UTC, and fixed-offset values support years
0000–9999. Zone rules come from the host's ICU/tzdb version, so different runtimes can disagree on
historical or future political rules. The package does not bundle or pin a zone database.

## Errors

Domain failures throw `DateTimeError` with a stable `code`. When ESM and CommonJS are loaded in the
same process, use `isDateTimeError(error)` and `error.code`; cross-build `instanceof` is not a
supported contract.

## Supported environments

- Node.js 22 or newer.
- Current Chromium, Firefox, and WebKit engines covered by the pinned Playwright release.

## License

MIT © 2026 Erik Karwatowski
