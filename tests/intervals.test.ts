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
  instantIntervalDifference,
  instantIntervalDuration,
  instantIntervalGap,
  instantIntervalIntersection,
  instantIntervalsOverlap,
  maximumInstant,
  maximumZonedDateTime,
  mergeInstantIntervals,
  mergeZonedDateTimeIntervals,
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
  zonedDateTimeIntervalDifference,
  zonedDateTimeIntervalDuration,
  zonedDateTimeIntervalGap,
  zonedDateTimeIntervalIntersection,
  zonedDateTimeIntervalsOverlap,
  zonedDateTimeUnitInterval,
} from "../src/index.js";
import { defined, expectDateTimeError } from "./helpers.js";

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

describe("intersection and gap", () => {
  it("returns the shared part and nothing for touching ranges", () => {
    const first = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    const second = instantSpan("2026-01-02T00:00:00.000Z", "2026-01-05T00:00:00.000Z");
    const shared = instantIntervalIntersection(first, second);
    expect(toInstantString(defined(shared).start)).toBe("2026-01-02T00:00:00.000Z");
    expect(toInstantString(defined(shared).end)).toBe("2026-01-03T00:00:00.000Z");

    const contained = instantIntervalIntersection(
      first,
      instantSpan("2026-01-01T06:00:00.000Z", "2026-01-01T12:00:00.000Z"),
    );
    expect(instantIntervalDuration(defined(contained)).milliseconds).toBe(6 * 3_600_000);

    const touching = instantSpan("2026-01-03T00:00:00.000Z", "2026-01-04T00:00:00.000Z");
    expect(instantIntervalIntersection(first, touching)).toBeUndefined();
    expect(
      instantIntervalIntersection(
        first,
        instantSpan("2026-02-01T00:00:00.000Z", "2026-02-02T00:00:00.000Z"),
      ),
    ).toBeUndefined();
  });

  it("keeps the zone of the left range when zones differ", () => {
    const left = createZonedDateTimeInterval({
      start: zoned("2026-01-01T00:00:00.000"),
      end: zoned("2026-01-03T00:00:00.000"),
    });
    const right = createZonedDateTimeInterval({
      start: withTimeZone(zoned("2026-01-02T00:00:00.000"), "Europe/Paris"),
      end: withTimeZone(zoned("2026-01-05T00:00:00.000"), "Europe/Paris"),
    });
    const shared = zonedDateTimeIntervalIntersection(left, right);
    expect(defined(shared).start.timeZone).toBe("America/New_York");
    expect(toZonedDateTimeString(defined(shared).start)).toBe(
      "2026-01-02T00:00:00.000-05:00[America/New_York]",
    );
    expect(defined(zonedDateTimeIntervalIntersection(right, left)).start.timeZone).toBe(
      "Europe/Paris",
    );

    const disjoint = createZonedDateTimeInterval({
      start: zoned("2026-06-01T00:00:00.000"),
      end: zoned("2026-06-02T00:00:00.000"),
    });
    expect(zonedDateTimeIntervalIntersection(left, disjoint)).toBeUndefined();
  });

  it("reports the space between disjoint ranges in either argument order", () => {
    const first = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    const later = instantSpan("2026-01-05T00:00:00.000Z", "2026-01-06T00:00:00.000Z");
    const gap = instantIntervalGap(first, later);
    expect(toInstantString(defined(gap).start)).toBe("2026-01-02T00:00:00.000Z");
    expect(toInstantString(defined(gap).end)).toBe("2026-01-05T00:00:00.000Z");
    expect(instantIntervalDuration(defined(instantIntervalGap(later, first))).milliseconds).toBe(
      3 * 86_400_000,
    );

    const touching = instantSpan("2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    expect(instantIntervalGap(first, touching)).toBeUndefined();
    expect(
      instantIntervalGap(
        first,
        instantSpan("2026-01-01T12:00:00.000Z", "2026-01-04T00:00:00.000Z"),
      ),
    ).toBeUndefined();
  });

  it("returns zoned gaps in the zone of the left range", () => {
    const left = createZonedDateTimeInterval({
      start: zoned("2026-01-01T00:00:00.000"),
      end: zoned("2026-01-02T00:00:00.000"),
    });
    const later = createZonedDateTimeInterval({
      start: withTimeZone(zoned("2026-01-05T00:00:00.000"), "Europe/Paris"),
      end: withTimeZone(zoned("2026-01-06T00:00:00.000"), "Europe/Paris"),
    });
    const gap = zonedDateTimeIntervalGap(left, later);
    expect(defined(gap).start.timeZone).toBe("America/New_York");
    expect(zonedDateTimeIntervalDuration(defined(gap)).milliseconds).toBe(3 * 86_400_000);
    expect(zonedDateTimeIntervalGap(left, left)).toBeUndefined();
  });
});

describe("difference", () => {
  const day = () => instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
  const at = (span: { start: { epochMilliseconds: number } }) => toInstantString(span.start);

  it("splits a range when the removal falls inside it", () => {
    const rest = instantIntervalDifference(
      day(),
      instantSpan("2026-01-01T09:00:00.000Z", "2026-01-01T10:00:00.000Z"),
    );
    expect(rest).toHaveLength(2);
    expect(at(defined(rest[0]))).toBe("2026-01-01T00:00:00.000Z");
    expect(toInstantString(defined(rest[0]).end)).toBe("2026-01-01T09:00:00.000Z");
    expect(at(defined(rest[1]))).toBe("2026-01-01T10:00:00.000Z");
    expect(toInstantString(defined(rest[1]).end)).toBe("2026-01-02T00:00:00.000Z");
    expect(Object.isFrozen(rest)).toBe(true);
  });

  it("trims one side when the removal covers an end", () => {
    const trailing = instantIntervalDifference(
      day(),
      instantSpan("2025-12-31T00:00:00.000Z", "2026-01-01T06:00:00.000Z"),
    );
    expect(trailing).toHaveLength(1);
    expect(at(defined(trailing[0]))).toBe("2026-01-01T06:00:00.000Z");

    const leading = instantIntervalDifference(
      day(),
      instantSpan("2026-01-01T18:00:00.000Z", "2026-01-03T00:00:00.000Z"),
    );
    expect(leading).toHaveLength(1);
    expect(toInstantString(defined(leading[0]).end)).toBe("2026-01-01T18:00:00.000Z");
  });

  it("removes everything or nothing at the extremes", () => {
    expect(
      instantIntervalDifference(
        day(),
        instantSpan("2025-12-31T00:00:00.000Z", "2026-01-03T00:00:00.000Z"),
      ),
    ).toHaveLength(0);

    const disjoint = instantIntervalDifference(
      day(),
      instantSpan("2026-02-01T00:00:00.000Z", "2026-02-02T00:00:00.000Z"),
    );
    expect(disjoint).toHaveLength(1);
    expect(at(defined(disjoint[0]))).toBe("2026-01-01T00:00:00.000Z");

    // Touching ranges share no instant, so subtracting one removes nothing.
    const touching = instantIntervalDifference(
      day(),
      instantSpan("2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"),
    );
    expect(touching).toHaveLength(1);
    expect(toInstantString(defined(touching[0]).end)).toBe("2026-01-02T00:00:00.000Z");

    const empty = instantSpan("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    expect(instantIntervalDifference(empty, day())).toHaveLength(0);
    expect(
      instantIntervalDifference(
        empty,
        instantSpan("2026-03-01T00:00:00.000Z", "2026-03-02T00:00:00.000Z"),
      ),
    ).toHaveLength(0);
  });

  it("keeps the zone of the left range across a DST change", () => {
    const dstDay = createZonedDateTimeInterval({
      start: zoned("2026-03-08T00:00:00.000"),
      end: zoned("2026-03-09T00:00:00.000"),
    });
    const removal = createZonedDateTimeInterval({
      start: withTimeZone(zoned("2026-03-08T06:00:00.000"), "Europe/Paris"),
      end: withTimeZone(zoned("2026-03-08T07:00:00.000"), "Europe/Paris"),
    });
    const rest = zonedDateTimeIntervalDifference(dstDay, removal);
    expect(rest).toHaveLength(2);
    expect(defined(rest[0]).start.timeZone).toBe("America/New_York");
    const total =
      zonedDateTimeIntervalDuration(defined(rest[0])).milliseconds +
      zonedDateTimeIntervalDuration(defined(rest[1])).milliseconds;
    expect(total).toBe(22 * 3_600_000);

    const untouched = zonedDateTimeIntervalDifference(
      dstDay,
      createZonedDateTimeInterval({
        start: zoned("2026-06-01T00:00:00.000"),
        end: zoned("2026-06-02T00:00:00.000"),
      }),
    );
    expect(untouched).toHaveLength(1);
    expect(zonedDateTimeIntervalDuration(defined(untouched[0])).milliseconds).toBe(23 * 3_600_000);
  });

  it("partitions the left range with its intersection", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 30 }),
        (leftStart, leftLength, rightStart, rightLength) => {
          const left = createInstantInterval({
            start: { epochMilliseconds: leftStart },
            end: { epochMilliseconds: leftStart + leftLength },
          });
          const right = createInstantInterval({
            start: { epochMilliseconds: rightStart },
            end: { epochMilliseconds: rightStart + rightLength },
          });
          const rest = instantIntervalDifference(left, right);
          const shared = instantIntervalIntersection(left, right);
          for (let point = 0; point <= 95; point += 1) {
            const value = { epochMilliseconds: point };
            const inLeft = instantIntervalContains(left, value);
            const inRest = rest.some((span) => instantIntervalContains(span, value));
            const inShared = shared !== undefined && instantIntervalContains(shared, value);
            // Every instant of left sits in exactly one of the two pieces, and nothing else does.
            expect(inRest || inShared).toBe(inLeft);
            expect(inRest && inShared).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("merging ranges", () => {
  it("merges overlapping and touching ranges and sorts by start", () => {
    const merged = mergeInstantIntervals([
      instantSpan("2026-01-05T00:00:00.000Z", "2026-01-06T00:00:00.000Z"),
      instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"),
      instantSpan("2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"),
    ]);
    expect(merged).toHaveLength(2);
    expect(toInstantString(defined(merged[0]).start)).toBe("2026-01-01T00:00:00.000Z");
    expect(toInstantString(defined(merged[0]).end)).toBe("2026-01-03T00:00:00.000Z");
    expect(toInstantString(defined(merged[1]).start)).toBe("2026-01-05T00:00:00.000Z");
    expect(Object.isFrozen(merged)).toBe(true);
  });

  it("absorbs a contained range and drops empty ones", () => {
    const merged = mergeInstantIntervals([
      instantSpan("2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z"),
      instantSpan("2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"),
    ]);
    expect(merged).toHaveLength(1);
    expect(toInstantString(defined(merged[0]).end)).toBe("2026-01-10T00:00:00.000Z");

    expect(
      mergeInstantIntervals([instantSpan("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")]),
    ).toHaveLength(0);
    expect(mergeInstantIntervals([])).toHaveLength(0);
  });

  it("shares the start but extends the end", () => {
    const merged = mergeInstantIntervals([
      instantSpan("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"),
      instantSpan("2026-01-01T00:00:00.000Z", "2026-01-04T00:00:00.000Z"),
    ]);
    expect(merged).toHaveLength(1);
    expect(toInstantString(defined(merged[0]).end)).toBe("2026-01-04T00:00:00.000Z");
  });

  it("merges zoned ranges and requires one shared zone", () => {
    const merged = mergeZonedDateTimeIntervals([
      createZonedDateTimeInterval({
        start: zoned("2026-01-01T00:00:00.000"),
        end: zoned("2026-01-02T00:00:00.000"),
      }),
      createZonedDateTimeInterval({
        start: zoned("2026-01-02T00:00:00.000"),
        end: zoned("2026-01-03T00:00:00.000"),
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(defined(merged[0]).start.timeZone).toBe("America/New_York");
    expect(zonedDateTimeIntervalDuration(defined(merged[0])).milliseconds).toBe(2 * 86_400_000);
    expect(mergeZonedDateTimeIntervals([])).toHaveLength(0);

    expectDateTimeError(
      () =>
        mergeZonedDateTimeIntervals([
          createZonedDateTimeInterval({
            start: zoned("2026-01-01T00:00:00.000"),
            end: zoned("2026-01-02T00:00:00.000"),
          }),
          createZonedDateTimeInterval({
            start: withTimeZone(zoned("2026-01-05T00:00:00.000"), "Europe/Paris"),
            end: withTimeZone(zoned("2026-01-06T00:00:00.000"), "Europe/Paris"),
          }),
        ]),
      "INVALID_RECORD",
    );
  });

  it("rejects non-array input", () => {
    expectDateTimeError(() => mergeInstantIntervals("nope" as never), "INVALID_TYPE");
    expectDateTimeError(() => mergeZonedDateTimeIntervals("nope" as never), "INVALID_TYPE");
  });

  it("produces disjoint, non-adjacent ranges covering the same instants", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .tuple(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 40 }))
            .map(([start, length]) => ({ start, end: start + length })),
          { minLength: 1, maxLength: 12 },
        ),
        (spans) => {
          const merged = mergeInstantIntervals(
            spans.map((span) =>
              createInstantInterval({
                start: { epochMilliseconds: span.start },
                end: { epochMilliseconds: span.end },
              }),
            ),
          );
          for (let index = 1; index < merged.length; index += 1) {
            // A strict gap must separate neighbours, otherwise they should have merged.
            expect(defined(merged[index]).start.epochMilliseconds).toBeGreaterThan(
              defined(merged[index - 1]).end.epochMilliseconds,
            );
          }
          for (const span of merged) {
            expect(span.end.epochMilliseconds).toBeGreaterThan(span.start.epochMilliseconds);
          }
          for (let point = 0; point <= 440; point += 1) {
            const value = { epochMilliseconds: point };
            const inSource = spans.some((span) => point >= span.start && point < span.end);
            const inMerged = merged.some((span) => instantIntervalContains(span, value));
            expect(inMerged).toBe(inSource);
          }
        },
      ),
      { numRuns: 200 },
    );
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
