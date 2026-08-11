import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addCalendarToPlainDate,
  addCalendarToPlainDateTime,
  addCalendarToZonedDateTime,
  addExactToInstant,
  addExactToZonedDateTime,
  compareInstants,
  compareZonedDateTimes,
  createCalendarDuration,
  createExactDuration,
  differenceInstants,
  differenceZonedDateTimes,
  equalInstants,
  equalZonedDateTimes,
  parseInstant,
  parsePlainDate,
  parsePlainDateTime,
  resolveZonedDateTime,
  subtractCalendarFromPlainDate,
  subtractCalendarFromPlainDateTime,
  subtractCalendarFromZonedDateTime,
  subtractExactFromInstant,
  subtractExactFromZonedDateTime,
  toInstantString,
  toPlainDateString,
  toPlainDateTimeString,
  toZonedDateTimeString,
  withTimeZone,
} from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

describe("arithmetic and comparison", () => {
  it("keeps exact arithmetic on the elapsed timeline", () => {
    const instant = parseInstant("2026-03-08T06:30:00.000Z");
    const hour = createExactDuration(3_600_000);
    expect(toInstantString(addExactToInstant(instant, hour))).toBe("2026-03-08T07:30:00.000Z");
    expect(subtractExactFromInstant(addExactToInstant(instant, hour), hour)).toEqual(instant);

    const zoned = resolveZonedDateTime(
      parsePlainDateTime("2026-03-08T01:30:00.000"),
      "America/New_York",
    );
    const moved = addExactToZonedDateTime(zoned, hour);
    expect(toZonedDateTimeString(moved)).toBe("2026-03-08T03:30:00.000-04:00[America/New_York]");
    expect(subtractExactFromZonedDateTime(moved, hour)).toEqual(zoned);
  });

  it("uses calendar arithmetic for dates and wall times", () => {
    const month = createCalendarDuration({ years: 0, months: 1, weeks: 0, days: 0 });
    const january31 = parsePlainDate("2024-01-31");
    expectDateTimeError(() => addCalendarToPlainDate(january31, month), "OVERFLOW");
    expect(
      toPlainDateString(addCalendarToPlainDate(january31, month, { overflow: "constrain" })),
    ).toBe("2024-02-29");
    expect(
      toPlainDateString(
        subtractCalendarFromPlainDate(parsePlainDate("2024-03-29"), month, {
          overflow: "constrain",
        }),
      ),
    ).toBe("2024-02-29");

    const day = createCalendarDuration({ years: 0, months: 0, weeks: 0, days: 1 });
    const plain = parsePlainDateTime("2024-02-28T12:30:00.000");
    expect(toPlainDateTimeString(addCalendarToPlainDateTime(plain, day))).toBe(
      "2024-02-29T12:30:00.000",
    );
    expect(subtractCalendarFromPlainDateTime(addCalendarToPlainDateTime(plain, day), day)).toEqual(
      plain,
    );
  });

  it("preserves wall time during zoned calendar arithmetic", () => {
    const day = createCalendarDuration({ years: 0, months: 0, weeks: 0, days: 1 });
    const start = resolveZonedDateTime(
      parsePlainDateTime("2026-03-07T12:00:00.000"),
      "America/New_York",
    );
    const end = addCalendarToZonedDateTime(start, day);
    expect(toZonedDateTimeString(end)).toBe("2026-03-08T12:00:00.000-04:00[America/New_York]");
    expect(differenceZonedDateTimes(start, end).milliseconds).toBe(23 * 3_600_000);
    expect(subtractCalendarFromZonedDateTime(end, day)).toEqual(start);
  });

  it("computes signed exact differences and comparisons", () => {
    const first = parseInstant("2026-01-01T00:00:00.000Z");
    const second = parseInstant("2026-01-01T00:00:01.000Z");
    expect(differenceInstants(first, second)).toEqual({ milliseconds: 1000 });
    expect(differenceInstants(second, first)).toEqual({ milliseconds: -1000 });
    expect(compareInstants(first, second)).toBe(-1);
    expect(compareInstants(second, first)).toBe(1);
    expect(compareInstants(first, first)).toBe(0);
    expect(equalInstants(first, first)).toBe(true);
    expect(equalInstants(first, second)).toBe(false);

    const utc = resolveZonedDateTime(parsePlainDateTime("2026-01-01T00:00:00.000"), "UTC");
    const ny = withTimeZone(utc, "America/New_York");
    expect(compareZonedDateTimes(utc, ny)).toBe(0);
    expect(equalZonedDateTimes(utc, ny)).toBe(false);
    expect(equalZonedDateTimes(utc, utc)).toBe(true);
  });

  it("rejects invalid arithmetic options and overflows", () => {
    const date = parsePlainDate("2026-01-01");
    const duration = createCalendarDuration({ years: 0, months: 1, weeks: 0, days: 0 });
    expectDateTimeError(
      () => addCalendarToPlainDate(date, duration, { overflow: "bad" as never }),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () =>
        addCalendarToPlainDate(
          date,
          createCalendarDuration({ years: 9999, months: 0, weeks: 0, days: 0 }),
        ),
      "OVERFLOW",
    );
    expectDateTimeError(
      () =>
        addExactToInstant(
          parseInstant("2026-01-01T00:00:00.000Z"),
          createExactDuration(Number.MAX_SAFE_INTEGER),
        ),
      "OVERFLOW",
    );
    expectDateTimeError(
      () =>
        subtractExactFromInstant(
          parseInstant("2026-01-01T00:00:00.000Z"),
          createExactDuration(Number.MIN_SAFE_INTEGER),
        ),
      "OVERFLOW",
    );
  });

  it("round-trips generated exact arithmetic", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3_000_000_000_000 }),
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        (epoch, delta) => {
          const value = { epochMilliseconds: epoch };
          const duration = createExactDuration(delta);
          expect(subtractExactFromInstant(addExactToInstant(value, duration), duration)).toEqual(
            value,
          );
        },
      ),
      { numRuns: 250 },
    );
  });
});
