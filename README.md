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
`ExactDuration`, `CalendarDuration`, `InstantInterval`, and `ZonedDateTimeInterval`. Every function
validates exact enumerable keys. Runtime identity, prototypes, and `instanceof` are not used for
values.

`ZonedDateTime` stores only an epoch millisecond and a zone identifier. Local fields and offsets are
derived from current host time-zone data.

## Intervals and boundaries

`InstantInterval` and `ZonedDateTimeInterval` are half-open ranges `[start, end)`. The end is
excluded, so `[a, b)` and `[b, c)` are adjacent rather than overlapping, and `start === end` is an
empty range. A reversed range rejects, and both endpoints of a zoned range must resolve to the same
normalized zone.

Containment, overlap, and duration are decided on the elapsed timeline, so a zoned day that crosses
a daylight-saving change measures 23 or 25 hours rather than 24. Values in a different zone can
still be compared against a range.

`startOfPlainDateTimeUnit`, `endOfPlainDateTimeUnit`, and their `ZonedDateTime` counterparts
truncate to `year`, `month`, `week`, `day`, `hour`, `minute`, or `second`. The end is **exclusive**:
the end of `2026-05-04` is `2026-05-05T00:00:00.000`, which is what makes
`zonedDateTimeUnitInterval` cover the unit exactly. Weeks start on Monday unless `weekStart` says
otherwise (ISO numbering, Sunday is 7).

Zoned boundaries resolve the truncated wall time back through the zone. Local midnight does not
exist on every calendar day, so a zone that skips it rejects by default and needs an explicit
`disambiguation`.

`instantIntervalIntersection` and `zonedDateTimeIntervalIntersection` return the shared part of two
ranges, or `undefined` when they share no instant. `instantIntervalGap` and
`zonedDateTimeIntervalGap` return the range strictly between two disjoint ranges, or `undefined`
when they overlap or merely touch; argument order does not matter. Because `[a, b)` and `[b, c)`
meet at a point both exclude, touching ranges intersect in nothing and have no gap rather than
producing an empty range at `b`. The zoned results carry the zone of the left argument.

`mergeInstantIntervals` and `mergeZonedDateTimeIntervals` reduce a list to the fewest ranges
covering the same instants, ordered by start. Touching ranges merge, since `[a, b)` and `[b, c)`
cover exactly `[a, c)` and keeping them apart would describe one span with two records. Empty
ranges cover no instant and drop out, so merging only empty ranges returns an empty list. Every
zoned range passed to `mergeZonedDateTimeIntervals` must already share one zone; merging across
zones would leave the zone of the result depending on sort order, so it rejects instead. Convert
with `withTimeZone` first.

`clampInstant` and `clampZonedDateTime` take inclusive `minimum` and `maximum` bounds, not an
interval record. `clampZonedDateTime` keeps the zone of the clamped value. `minimumInstant`,
`maximumInstant`, and their zoned counterparts order by elapsed time and keep the first value on a
tie.

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
