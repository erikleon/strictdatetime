import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  clampInstant,
  clampZonedDateTime,
  createInstantInterval,
  createZonedDateTimeInterval,
  endOfPlainDateTimeUnit,
  endOfZonedDateTimeUnit,
  type IntervalUnit,
  instantIntervalContains,
  instantIntervalDuration,
  instantIntervalsOverlap,
  maximumInstant,
  maximumZonedDateTime,
  minimumInstant,
  minimumZonedDateTime,
  parseInstant,
  parsePlainDateTime,
  parseZonedDateTime,
  resolveZonedDateTime,
  startOfPlainDateTimeUnit,
  startOfZonedDateTimeUnit,
  toInstantString,
  toPlainDateTimeString,
  toZonedDateTimeString,
  withTimeZone,
  zonedDateTimeIntervalContains,
  zonedDateTimeIntervalDuration,
  zonedDateTimeIntervalsOverlap,
  zonedDateTimeUnitInterval,
} from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

const instant = (value: string) => parseInstant(value);
const zoned = (wall: string, zone = "America/New_York") =>
  resolveZonedDateTime(parsePlainDateTime(wall), zone);

const instantSpan = (start: string, end: string) =>
  createInstantInterval({ start: instant(start), end: instant(end) });

describe("interval records", () => {
  it("builds ordered half-open ranges", () => {
    const span = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    expect(toInstantString(span.start)).toBe("2026-01-01T00:00:00.000Z");
    expect(instantIntervalDuration(span).milliseconds).toBe(86_400_000);
    expect(Object.isFrozen(span)).toBe(true);

    const empty = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    expect(instantIntervalDuration(empty).milliseconds).toBe(0);
  });

  it("measures zoned ranges on the elapsed timeline", () => {
    const span = createZonedDateTimeInterval({
      start: zoned("2026-03-08T00:00:00.000"),
      end: zoned("2026-03-09T00:00:00.000"),
    });
    expect(zonedDateTimeIntervalDuration(span).milliseconds).toBe(23 * 3_600_000);
  });

  it("normalizes endpoint zones before comparing them", () => {
    const span = createZonedDateTimeInterval({
      start: parseZonedDateTime("2026-01-01T00:00:00.000+00:00[Z]"),
      end: parseZonedDateTime("2026-01-02T00:00:00.000+00:00[UTC]"),
    });
    expect(span.start.timeZone).toBe("UTC");
    expect(span.end.timeZone).toBe("UTC");
  });

  it("rejects malformed, reversed, and mixed-zone ranges", () => {
    expectDateTimeError(
      () => createInstantInterval({ start: instant("2026-01-01T00:00:00.000Z") } as never),
      "INVALID_RECORD",
    );
    expectDateTimeError(
      () => instantSpan("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
      "INVALID_RECORD",
    );
    expectDateTimeError(
      () =>
        createZonedDateTimeInterval({
          start: zoned("2026-01-02T00:00:00.000"),
          end: zoned("2026-01-01T00:00:00.000"),
        }),
      "INVALID_RECORD",
    );
    expectDateTimeError(
      () =>
        createZonedDateTimeInterval({
          start: zoned("2026-01-01T00:00:00.000"),
          end: withTimeZone(zoned("2026-01-02T00:00:00.000"), "Europe/Paris"),
        }),
      "INVALID_RECORD",
    );
  });
});

describe("containment and overlap", () => {
  it("includes the start and excludes the end", () => {
    const span = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    expect(instantIntervalContains(span, instant("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(instantIntervalContains(span, instant("2026-01-01T12:00:00.000Z"))).toBe(true);
    expect(instantIntervalContains(span, instant("2026-01-02T00:00:00.000Z"))).toBe(false);
    expect(instantIntervalContains(span, instant("2025-12-31T23:59:59.999Z"))).toBe(false);
  });

  it("compares zoned values across zones", () => {
    const span = createZonedDateTimeInterval({
      start: zoned("2026-01-01T00:00:00.000"),
      end: zoned("2026-01-02T00:00:00.000"),
    });
    const inside = withTimeZone(zoned("2026-01-01T12:00:00.000"), "Europe/Paris");
    expect(zonedDateTimeIntervalContains(span, inside)).toBe(true);
    expect(zonedDateTimeIntervalContains(span, zoned("2026-01-03T00:00:00.000"))).toBe(false);
  });

  it("treats touching ranges as non-overlapping", () => {
    const first = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    const second = instantSpan("2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    const middle = instantSpan("2026-01-01T12:00:00.000Z", "2026-01-02T12:00:00.000Z");
    expect(instantIntervalsOverlap(first, second)).toBe(false);
    expect(instantIntervalsOverlap(second, first)).toBe(false);
    expect(instantIntervalsOverlap(first, middle)).toBe(true);
    expect(instantIntervalsOverlap(middle, first)).toBe(true);

    const zonedFirst = createZonedDateTimeInterval({
      start: zoned("2026-01-01T00:00:00.000"),
      end: zoned("2026-01-02T00:00:00.000"),
    });
    const zonedSecond = createZonedDateTimeInterval({
      start: withTimeZone(zoned("2026-01-01T12:00:00.000"), "Europe/Paris"),
      end: withTimeZone(zoned("2026-01-02T12:00:00.000"), "Europe/Paris"),
    });
    expect(zonedDateTimeIntervalsOverlap(zonedFirst, zonedSecond)).toBe(true);
  });
});

describe("minimum, maximum, and clamp", () => {
  it("selects extremes and keeps the first tie", () => {
    const values = [
      instant("2026-01-02T00:00:00.000Z"),
      instant("2026-01-01T00:00:00.000Z"),
      instant("2026-01-03T00:00:00.000Z"),
    ];
    expect(toInstantString(minimumInstant(values))).toBe("2026-01-01T00:00:00.000Z");
    expect(toInstantString(maximumInstant(values))).toBe("2026-01-03T00:00:00.000Z");

    const paris = withTimeZone(zoned("2026-01-01T00:00:00.000"), "Europe/Paris");
    const newYork = zoned("2026-01-01T00:00:00.000");
    expect(minimumZonedDateTime([paris, newYork]).timeZone).toBe("Europe/Paris");
    expect(maximumZonedDateTime([paris, newYork]).timeZone).toBe("Europe/Paris");
    expect(minimumZonedDateTime([newYork, zoned("2025-01-01T00:00:00.000")]).timeZone).toBe(
      "America/New_York",
    );
    expect(
      toZonedDateTimeString(maximumZonedDateTime([newYork, zoned("2026-06-01T00:00:00.000")])),
    ).toBe("2026-06-01T00:00:00.000-04:00[America/New_York]");
  });

  it("rejects empty and non-array inputs", () => {
    expectDateTimeError(() => minimumInstant([]), "INVALID_RECORD");
    expectDateTimeError(() => maximumInstant("nope" as never), "INVALID_TYPE");
  });

  it("clamps to inclusive bounds", () => {
    const low = instant("2026-01-01T00:00:00.000Z");
    const high = instant("2026-01-31T00:00:00.000Z");
    expect(toInstantString(clampInstant(instant("2025-06-01T00:00:00.000Z"), low, high))).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(toInstantString(clampInstant(instant("2027-06-01T00:00:00.000Z"), low, high))).toBe(
      "2026-01-31T00:00:00.000Z",
    );
    expect(toInstantString(clampInstant(instant("2026-01-15T00:00:00.000Z"), low, high))).toBe(
      "2026-01-15T00:00:00.000Z",
    );
    expectDateTimeError(() => clampInstant(low, high, low), "INVALID_RECORD");
  });

  it("keeps the clamped value's zone", () => {
    const value = withTimeZone(zoned("2027-01-01T00:00:00.000"), "Europe/Paris");
    const clamped = clampZonedDateTime(
      value,
      zoned("2026-01-01T00:00:00.000"),
      zoned("2026-01-31T00:00:00.000"),
    );
    expect(toZonedDateTimeString(clamped)).toBe("2026-01-31T06:00:00.000+01:00[Europe/Paris]");
    expect(clampZonedDateTime(value, zoned("2020-01-01T00:00:00.000"), value)).toEqual(value);
  });
});

describe("unit boundaries", () => {
  const plain = parsePlainDateTime("2026-05-14T13:47:31.512");

  it("truncates plain wall time to each unit", () => {
    const expected: Record<IntervalUnit, [string, string]> = {
      year: ["2026-01-01T00:00:00.000", "2027-01-01T00:00:00.000"],
      month: ["2026-05-01T00:00:00.000", "2026-06-01T00:00:00.000"],
      week: ["2026-05-11T00:00:00.000", "2026-05-18T00:00:00.000"],
      day: ["2026-05-14T00:00:00.000", "2026-05-15T00:00:00.000"],
      hour: ["2026-05-14T13:00:00.000", "2026-05-14T14:00:00.000"],
      minute: ["2026-05-14T13:47:00.000", "2026-05-14T13:48:00.000"],
      second: ["2026-05-14T13:47:31.000", "2026-05-14T13:47:32.000"],
    };
    for (const [unit, [start, end]] of Object.entries(expected) as [
      IntervalUnit,
      [string, string],
    ][]) {
      expect(toPlainDateTimeString(startOfPlainDateTimeUnit(plain, unit))).toBe(start);
      expect(toPlainDateTimeString(endOfPlainDateTimeUnit(plain, unit))).toBe(end);
    }
  });

  it("rolls December into the next year", () => {
    const december = parsePlainDateTime("2026-12-09T08:00:00.000");
    expect(toPlainDateTimeString(endOfPlainDateTimeUnit(december, "month"))).toBe(
      "2027-01-01T00:00:00.000",
    );
  });

  it("honors an explicit week start", () => {
    expect(toPlainDateTimeString(startOfPlainDateTimeUnit(plain, "week", { weekStart: 7 }))).toBe(
      "2026-05-10T00:00:00.000",
    );
    expect(toPlainDateTimeString(startOfPlainDateTimeUnit(plain, "week", { weekStart: 4 }))).toBe(
      "2026-05-14T00:00:00.000",
    );
  });

  it("rejects unknown units and week starts", () => {
    expectDateTimeError(
      () => startOfPlainDateTimeUnit(plain, "fortnight" as never),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () => endOfPlainDateTimeUnit(plain, "fortnight" as never),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () => startOfPlainDateTimeUnit(plain, "week", { weekStart: 0 as never }),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () => startOfPlainDateTimeUnit(plain, "week", { weekStart: 8 as never }),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () => startOfPlainDateTimeUnit(plain, "week", { weekStart: 1.5 as never }),
      "INVALID_OPTION",
    );
  });

  it("rejects boundaries outside the supported year range", () => {
    expectDateTimeError(
      () => endOfPlainDateTimeUnit(parsePlainDateTime("9999-12-31T00:00:00.000"), "year"),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => startOfPlainDateTimeUnit(parsePlainDateTime("0000-01-01T00:00:00.000"), "week"),
      "OUT_OF_RANGE",
    );
  });

  it("resolves zoned boundaries back through the zone", () => {
    const value = zoned("2026-03-08T15:00:00.000");
    expect(toZonedDateTimeString(startOfZonedDateTimeUnit(value, "day"))).toBe(
      "2026-03-08T00:00:00.000-05:00[America/New_York]",
    );
    expect(toZonedDateTimeString(endOfZonedDateTimeUnit(value, "day"))).toBe(
      "2026-03-09T00:00:00.000-04:00[America/New_York]",
    );

    const span = zonedDateTimeUnitInterval(value, "day");
    expect(zonedDateTimeIntervalDuration(span).milliseconds).toBe(23 * 3_600_000);
    expect(zonedDateTimeIntervalContains(span, value)).toBe(true);
    expect(zonedDateTimeIntervalContains(span, span.end)).toBe(false);
  });

  it("rejects a missing local midnight unless disambiguation is explicit", () => {
    // Santiago skips 2026-09-06T00:00 local, jumping from 23:59:59.999-04:00 to 01:00-03:00.
    const value = resolveZonedDateTime(
      parsePlainDateTime("2026-09-06T12:00:00.000"),
      "America/Santiago",
    );
    expectDateTimeError(() => startOfZonedDateTimeUnit(value, "day"), "NONEXISTENT_TIME");
    expect(
      toZonedDateTimeString(startOfZonedDateTimeUnit(value, "day", { disambiguation: "later" })),
    ).toBe("2026-09-06T01:00:00.000-03:00[America/Santiago]");
    expect(
      toZonedDateTimeString(startOfZonedDateTimeUnit(value, "day", { disambiguation: "earlier" })),
    ).toBe("2026-09-05T23:00:00.000-04:00[America/Santiago]");
    expect(
      toZonedDateTimeString(endOfZonedDateTimeUnit(value, "day", { disambiguation: "later" })),
    ).toBe("2026-09-07T00:00:00.000-03:00[America/Santiago]");
  });

  it("covers every instant exactly once across adjacent units", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_600_000_000_000, max: 2_400_000_000_000 }),
        fc.constantFrom<IntervalUnit>("year", "month", "week", "day", "hour", "minute", "second"),
        (epoch, unit) => {
          const value = { epochMilliseconds: epoch, timeZone: "UTC" as const };
          const span = zonedDateTimeUnitInterval(value, unit);
          expect(zonedDateTimeIntervalContains(span, value)).toBe(true);
          expect(
            zonedDateTimeIntervalsOverlap(span, zonedDateTimeUnitInterval(span.end, unit)),
          ).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
