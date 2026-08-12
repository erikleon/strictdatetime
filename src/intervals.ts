import { fail } from "./errors.js";
import type {
  ExactDuration,
  Instant,
  InstantInterval,
  IntervalUnit,
  PlainDateTime,
  UnitBoundaryOptions,
  WeekStart,
  ZonedDateTime,
  ZonedDateTimeInterval,
  ZonedUnitBoundaryOptions,
} from "./types.js";
import {
  assertInstant,
  assertPlainDateTime,
  assertZonedDateTime,
  createExactDuration,
  createInstant,
  createPlainDateTime,
  epochFromUtcFields,
  ownRecord,
  plainDateTimeFromUtcEpoch,
} from "./values.js";
import { projectInstant, resolveZonedDateTime, zonedDateTimeFromInstant } from "./zones.js";

const UNITS: readonly string[] = [
  "year",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
] as const;

const MIDNIGHT = { hour: 0, minute: 0, second: 0, millisecond: 0 } as const;

/** Re-derives the zone through `normalizeTimeZone` so two endpoints can be compared by string. */
function normalizedZoned(value: unknown): ZonedDateTime {
  const zoned = assertZonedDateTime(value);
  return zonedDateTimeFromInstant({ epochMilliseconds: zoned.epochMilliseconds }, zoned.timeZone);
}

function assertUnit(unit: IntervalUnit): IntervalUnit {
  if (!UNITS.includes(unit)) fail("INVALID_OPTION", `Unsupported unit: ${String(unit)}`);
  return unit;
}

function weekStartOption(options?: UnitBoundaryOptions): WeekStart {
  const value = options?.weekStart ?? 1;
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    fail("INVALID_OPTION", `Unsupported weekStart: ${String(value)}`);
  }
  return value;
}

export function createInstantInterval(fields: InstantInterval): InstantInterval {
  const record = ownRecord(fields, ["start", "end"], "InstantInterval");
  const start = assertInstant(record.start);
  const end = assertInstant(record.end);
  if (end.epochMilliseconds < start.epochMilliseconds) {
    fail("INVALID_RECORD", "InstantInterval end must not precede start");
  }
  return Object.freeze({ start, end });
}

export function createZonedDateTimeInterval(fields: ZonedDateTimeInterval): ZonedDateTimeInterval {
  const record = ownRecord(fields, ["start", "end"], "ZonedDateTimeInterval");
  const start = normalizedZoned(record.start);
  const end = normalizedZoned(record.end);
  if (start.timeZone !== end.timeZone) {
    fail("INVALID_RECORD", "ZonedDateTimeInterval endpoints must share one time zone");
  }
  if (end.epochMilliseconds < start.epochMilliseconds) {
    fail("INVALID_RECORD", "ZonedDateTimeInterval end must not precede start");
  }
  return Object.freeze({ start, end });
}

export function instantIntervalDuration(interval: InstantInterval): ExactDuration {
  const value = createInstantInterval(interval);
  return createExactDuration(value.end.epochMilliseconds - value.start.epochMilliseconds);
}

/**
 * Elapsed length of the interval. A zoned day that crosses a DST change is 23 or 25 hours long,
 * not 24.
 */
export function zonedDateTimeIntervalDuration(interval: ZonedDateTimeInterval): ExactDuration {
  const value = createZonedDateTimeInterval(interval);
  return createExactDuration(value.end.epochMilliseconds - value.start.epochMilliseconds);
}

function containsEpoch(start: number, end: number, value: number): boolean {
  return value >= start && value < end;
}

export function instantIntervalContains(interval: InstantInterval, value: Instant): boolean {
  const bounds = createInstantInterval(interval);
  return containsEpoch(
    bounds.start.epochMilliseconds,
    bounds.end.epochMilliseconds,
    assertInstant(value).epochMilliseconds,
  );
}

/** Containment is decided on the elapsed timeline. The value's own zone is not compared. */
export function zonedDateTimeIntervalContains(
  interval: ZonedDateTimeInterval,
  value: ZonedDateTime,
): boolean {
  const bounds = createZonedDateTimeInterval(interval);
  return containsEpoch(
    bounds.start.epochMilliseconds,
    bounds.end.epochMilliseconds,
    assertZonedDateTime(value).epochMilliseconds,
  );
}

function overlaps(
  left: { start: number; end: number },
  right: { start: number; end: number },
): boolean {
  return left.start < right.end && right.start < left.end;
}

function epochBounds(interval: {
  start: { epochMilliseconds: number };
  end: { epochMilliseconds: number };
}) {
  return { start: interval.start.epochMilliseconds, end: interval.end.epochMilliseconds };
}

/** Touching intervals such as `[a, b)` and `[b, c)` do not overlap. */
export function instantIntervalsOverlap(left: InstantInterval, right: InstantInterval): boolean {
  return overlaps(
    epochBounds(createInstantInterval(left)),
    epochBounds(createInstantInterval(right)),
  );
}

/** Overlap is decided on the elapsed timeline. The two intervals may use different zones. */
export function zonedDateTimeIntervalsOverlap(
  left: ZonedDateTimeInterval,
  right: ZonedDateTimeInterval,
): boolean {
  return overlaps(
    epochBounds(createZonedDateTimeInterval(left)),
    epochBounds(createZonedDateTimeInterval(right)),
  );
}

type EpochBounds = { start: number; end: number };

function intersectionBounds(left: EpochBounds, right: EpochBounds): EpochBounds | undefined {
  if (!overlaps(left, right)) return undefined;
  return {
    start: Math.max(left.start, right.start),
    end: Math.min(left.end, right.end),
  };
}

/**
 * Shared part of two ranges, or `undefined` when they share no instant. Touching ranges such as
 * `[a, b)` and `[b, c)` meet at a point the half-open form excludes from both, so they intersect
 * in nothing rather than in an empty range at `b`.
 */
export function instantIntervalIntersection(
  left: InstantInterval,
  right: InstantInterval,
): InstantInterval | undefined {
  const bounds = intersectionBounds(
    epochBounds(createInstantInterval(left)),
    epochBounds(createInstantInterval(right)),
  );
  if (bounds === undefined) return undefined;
  return createInstantInterval({
    start: createInstant(bounds.start),
    end: createInstant(bounds.end),
  });
}

/**
 * The two ranges may use different zones because the overlap is decided on the elapsed timeline.
 * The result carries the zone of `left`, matching how {@link clampZonedDateTime} keeps the zone of
 * the value it clamps.
 */
export function zonedDateTimeIntervalIntersection(
  left: ZonedDateTimeInterval,
  right: ZonedDateTimeInterval,
): ZonedDateTimeInterval | undefined {
  const first = createZonedDateTimeInterval(left);
  const bounds = intersectionBounds(
    epochBounds(first),
    epochBounds(createZonedDateTimeInterval(right)),
  );
  if (bounds === undefined) return undefined;
  const zone = first.start.timeZone;
  return createZonedDateTimeInterval({
    start: zonedDateTimeFromInstant({ epochMilliseconds: bounds.start }, zone),
    end: zonedDateTimeFromInstant({ epochMilliseconds: bounds.end }, zone),
  });
}

function gapBounds(left: EpochBounds, right: EpochBounds): EpochBounds | undefined {
  const [earlier, later] = left.start <= right.start ? [left, right] : [right, left];
  if (later.start <= earlier.end) return undefined;
  return { start: earlier.end, end: later.start };
}

/**
 * Range strictly between two disjoint ranges, or `undefined` when they overlap or merely touch.
 * Argument order does not matter. A gap always has positive length, so touching ranges report no
 * gap rather than an empty one.
 */
export function instantIntervalGap(
  left: InstantInterval,
  right: InstantInterval,
): InstantInterval | undefined {
  const bounds = gapBounds(
    epochBounds(createInstantInterval(left)),
    epochBounds(createInstantInterval(right)),
  );
  if (bounds === undefined) return undefined;
  return createInstantInterval({
    start: createInstant(bounds.start),
    end: createInstant(bounds.end),
  });
}

/** The result carries the zone of `left`, matching {@link zonedDateTimeIntervalIntersection}. */
export function zonedDateTimeIntervalGap(
  left: ZonedDateTimeInterval,
  right: ZonedDateTimeInterval,
): ZonedDateTimeInterval | undefined {
  const first = createZonedDateTimeInterval(left);
  const bounds = gapBounds(epochBounds(first), epochBounds(createZonedDateTimeInterval(right)));
  if (bounds === undefined) return undefined;
  const zone = first.start.timeZone;
  return createZonedDateTimeInterval({
    start: zonedDateTimeFromInstant({ epochMilliseconds: bounds.start }, zone),
    end: zonedDateTimeFromInstant({ epochMilliseconds: bounds.end }, zone),
  });
}

function differenceBounds(left: EpochBounds, right: EpochBounds): EpochBounds[] {
  if (!overlaps(left, right)) return left.end > left.start ? [left] : [];
  const parts: EpochBounds[] = [];
  if (right.start > left.start) parts.push({ start: left.start, end: right.start });
  if (right.end < left.end) parts.push({ start: right.end, end: left.end });
  return parts;
}

/**
 * Part of `left` that `right` does not cover, ordered by start. Removing the middle of a range
 * splits it, so the result holds two ranges; removing an end or nothing gives one, and removing
 * everything gives none. Touching ranges cover no shared instant and so remove nothing. Empty
 * ranges never appear in the result, matching {@link mergeInstantIntervals}.
 */
export function instantIntervalDifference(
  left: InstantInterval,
  right: InstantInterval,
): readonly InstantInterval[] {
  const parts = differenceBounds(
    epochBounds(createInstantInterval(left)),
    epochBounds(createInstantInterval(right)),
  );
  return Object.freeze(
    parts.map((span) =>
      createInstantInterval({ start: createInstant(span.start), end: createInstant(span.end) }),
    ),
  );
}

/** The results carry the zone of `left`, matching {@link zonedDateTimeIntervalIntersection}. */
export function zonedDateTimeIntervalDifference(
  left: ZonedDateTimeInterval,
  right: ZonedDateTimeInterval,
): readonly ZonedDateTimeInterval[] {
  const first = createZonedDateTimeInterval(left);
  const zone = first.start.timeZone;
  const parts = differenceBounds(
    epochBounds(first),
    epochBounds(createZonedDateTimeInterval(right)),
  );
  return Object.freeze(
    parts.map((span) =>
      createZonedDateTimeInterval({
        start: zonedDateTimeFromInstant({ epochMilliseconds: span.start }, zone),
        end: zonedDateTimeFromInstant({ epochMilliseconds: span.end }, zone),
      }),
    ),
  );
}

/**
 * Reduces spans to the fewest ranges covering the same instants, ordered by start.
 *
 * Touching ranges merge: `[a, b)` and `[b, c)` cover exactly `[a, c)` under half-open semantics, so
 * keeping them apart would describe one span with two records. Empty ranges cover no instant and
 * drop out.
 */
function mergeBounds(values: readonly EpochBounds[]): EpochBounds[] {
  const spans = values.filter((span) => span.end > span.start);
  spans.sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: EpochBounds[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last === undefined || span.start > last.end) {
      merged.push(span);
    } else if (span.end > last.end) {
      merged[merged.length - 1] = { start: last.start, end: span.end };
    }
  }
  return merged;
}

function assertIntervalArray(values: readonly unknown[]): readonly unknown[] {
  if (!Array.isArray(values)) fail("INVALID_TYPE", "intervals must be an array");
  return values;
}

/** Empty ranges drop out, and touching ranges merge, so the result is disjoint and non-adjacent. */
export function mergeInstantIntervals(
  intervals: readonly InstantInterval[],
): readonly InstantInterval[] {
  const bounds = assertIntervalArray(intervals).map((value) =>
    epochBounds(createInstantInterval(value as InstantInterval)),
  );
  return Object.freeze(
    mergeBounds(bounds).map((span) =>
      createInstantInterval({ start: createInstant(span.start), end: createInstant(span.end) }),
    ),
  );
}

/**
 * Every range must already share one zone. Merging across zones would leave the zone of the result
 * depending on sort order, which is exactly the kind of implicit choice this library rejects.
 * Convert with `withTimeZone` first when the inputs disagree.
 */
export function mergeZonedDateTimeIntervals(
  intervals: readonly ZonedDateTimeInterval[],
): readonly ZonedDateTimeInterval[] {
  const records = assertIntervalArray(intervals).map((value) =>
    createZonedDateTimeInterval(value as ZonedDateTimeInterval),
  );
  const first = records[0];
  if (first === undefined) return Object.freeze([]);
  const zone = first.start.timeZone;
  for (const record of records) {
    if (record.start.timeZone !== zone) {
      fail("INVALID_RECORD", "mergeZonedDateTimeIntervals requires one shared time zone");
    }
  }
  return Object.freeze(
    mergeBounds(records.map(epochBounds)).map((span) =>
      createZonedDateTimeInterval({
        start: zonedDateTimeFromInstant({ epochMilliseconds: span.start }, zone),
        end: zonedDateTimeFromInstant({ epochMilliseconds: span.end }, zone),
      }),
    ),
  );
}

function extreme<T extends { epochMilliseconds: number }>(
  values: readonly unknown[],
  direction: -1 | 1,
  name: string,
  convert: (value: unknown) => T,
): T {
  if (!Array.isArray(values)) fail("INVALID_TYPE", `${name} must be an array`);
  let best: T | undefined;
  for (const value of values) {
    const candidate = convert(value);
    if (
      best === undefined ||
      Math.sign(candidate.epochMilliseconds - best.epochMilliseconds) === direction
    ) {
      best = candidate;
    }
  }
  if (best === undefined) fail("INVALID_RECORD", `${name} must contain at least one value`);
  return best;
}

export function minimumInstant(values: readonly Instant[]): Instant {
  return extreme(values, -1, "values", assertInstant);
}

export function maximumInstant(values: readonly Instant[]): Instant {
  return extreme(values, 1, "values", assertInstant);
}

/** Ordered by elapsed time. Ties keep the first value, so the caller's zone choice survives. */
export function minimumZonedDateTime(values: readonly ZonedDateTime[]): ZonedDateTime {
  return extreme(values, -1, "values", normalizedZoned);
}

export function maximumZonedDateTime(values: readonly ZonedDateTime[]): ZonedDateTime {
  return extreme(values, 1, "values", normalizedZoned);
}

function clampEpoch(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) fail("INVALID_RECORD", "maximum must not precede minimum");
  return Math.min(Math.max(value, minimum), maximum);
}

/** Bounds are inclusive here, unlike the half-open interval records. */
export function clampInstant(value: Instant, minimum: Instant, maximum: Instant): Instant {
  return createInstant(
    clampEpoch(
      assertInstant(value).epochMilliseconds,
      assertInstant(minimum).epochMilliseconds,
      assertInstant(maximum).epochMilliseconds,
    ),
  );
}

/** The result keeps the zone of `value`; the bounds only move the instant. */
export function clampZonedDateTime(
  value: ZonedDateTime,
  minimum: ZonedDateTime,
  maximum: ZonedDateTime,
): ZonedDateTime {
  const zoned = assertZonedDateTime(value);
  const clamped = clampEpoch(
    zoned.epochMilliseconds,
    assertZonedDateTime(minimum).epochMilliseconds,
    assertZonedDateTime(maximum).epochMilliseconds,
  );
  return zonedDateTimeFromInstant({ epochMilliseconds: clamped }, zoned.timeZone);
}

function isoWeekday(value: PlainDateTime): number {
  const day = new Date(epochFromUtcFields({ ...value, ...MIDNIGHT })).getUTCDay();
  return ((day + 6) % 7) + 1;
}

function startOfPlain(
  value: PlainDateTime,
  unit: IntervalUnit,
  weekStart: WeekStart,
): PlainDateTime {
  const plain = assertPlainDateTime(value);
  switch (unit) {
    case "year":
      return createPlainDateTime({ year: plain.year, month: 1, day: 1, ...MIDNIGHT });
    case "month":
      return createPlainDateTime({ year: plain.year, month: plain.month, day: 1, ...MIDNIGHT });
    case "week": {
      const midnight = epochFromUtcFields({ ...plain, ...MIDNIGHT });
      const back = (isoWeekday(plain) - weekStart + 7) % 7;
      return plainDateTimeFromUtcEpoch(midnight - back * 86_400_000);
    }
    case "day":
      return createPlainDateTime({ ...plain, ...MIDNIGHT });
    case "hour":
      return createPlainDateTime({ ...plain, minute: 0, second: 0, millisecond: 0 });
    case "minute":
      return createPlainDateTime({ ...plain, second: 0, millisecond: 0 });
    default:
      return createPlainDateTime({ ...plain, millisecond: 0 });
  }
}

/** Takes the start of a unit and returns the start of the following one. */
function nextPlainStart(start: PlainDateTime, unit: IntervalUnit): PlainDateTime {
  switch (unit) {
    case "year":
      return createPlainDateTime({ ...start, year: start.year + 1 });
    case "month":
      return createPlainDateTime({
        ...start,
        year: start.month === 12 ? start.year + 1 : start.year,
        month: start.month === 12 ? 1 : start.month + 1,
      });
    case "week":
      return plainDateTimeFromUtcEpoch(epochFromUtcFields(start) + 7 * 86_400_000);
    case "day":
      return plainDateTimeFromUtcEpoch(epochFromUtcFields(start) + 86_400_000);
    case "hour":
      return plainDateTimeFromUtcEpoch(epochFromUtcFields(start) + 3_600_000);
    case "minute":
      return plainDateTimeFromUtcEpoch(epochFromUtcFields(start) + 60_000);
    default:
      return plainDateTimeFromUtcEpoch(epochFromUtcFields(start) + 1000);
  }
}

export function startOfPlainDateTimeUnit(
  value: PlainDateTime,
  unit: IntervalUnit,
  options?: UnitBoundaryOptions,
): PlainDateTime {
  return startOfPlain(value, assertUnit(unit), weekStartOption(options));
}

/**
 * Exclusive end: the start of the next unit, so `[start, end)` covers the unit exactly. The end of
 * 2026-05-04 is 2026-05-05T00:00:00.000, not 2026-05-04T23:59:59.999.
 */
export function endOfPlainDateTimeUnit(
  value: PlainDateTime,
  unit: IntervalUnit,
  options?: UnitBoundaryOptions,
): PlainDateTime {
  const checked = assertUnit(unit);
  return nextPlainStart(startOfPlain(value, checked, weekStartOption(options)), checked);
}

/**
 * Wall-clock boundary resolved back into the zone. Midnight does not exist on every calendar day,
 * so this rejects by default and needs an explicit `disambiguation` where a zone skips it.
 */
export function startOfZonedDateTimeUnit(
  value: ZonedDateTime,
  unit: IntervalUnit,
  options?: ZonedUnitBoundaryOptions,
): ZonedDateTime {
  const zoned = assertZonedDateTime(value);
  const plain = projectInstant(zoned.epochMilliseconds, zoned.timeZone);
  const start = startOfPlain(plain, assertUnit(unit), weekStartOption(options));
  return resolveZonedDateTime(start, zoned.timeZone, options);
}

/** Exclusive end, matching {@link endOfPlainDateTimeUnit}. */
export function endOfZonedDateTimeUnit(
  value: ZonedDateTime,
  unit: IntervalUnit,
  options?: ZonedUnitBoundaryOptions,
): ZonedDateTime {
  const checked = assertUnit(unit);
  const zoned = assertZonedDateTime(value);
  const plain = projectInstant(zoned.epochMilliseconds, zoned.timeZone);
  const start = startOfPlain(plain, checked, weekStartOption(options));
  return resolveZonedDateTime(nextPlainStart(start, checked), zoned.timeZone, options);
}

export function zonedDateTimeUnitInterval(
  value: ZonedDateTime,
  unit: IntervalUnit,
  options?: ZonedUnitBoundaryOptions,
): ZonedDateTimeInterval {
  return createZonedDateTimeInterval({
    start: startOfZonedDateTimeUnit(value, unit, options),
    end: endOfZonedDateTimeUnit(value, unit, options),
  });
}
