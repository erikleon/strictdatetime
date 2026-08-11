import { describe, expect, it } from "vitest";
import {
  createCalendarDuration,
  createExactDuration,
  createInstant,
  createPlainDate,
  createPlainDateTime,
  createPlainTime,
  createZonedDateTime,
  daysInMonth,
  instantFromDate,
  instantToDate,
  isLeapYear,
} from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

describe("value factories", () => {
  it("creates frozen exact structural records", () => {
    const instant = createInstant(0);
    expect(instant).toEqual({ epochMilliseconds: 0 });
    expect(Object.isFrozen(instant)).toBe(true);
    expect(createPlainDate({ year: 2024, month: 2, day: 29 })).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(createPlainTime({ hour: 23, minute: 59, second: 59, millisecond: 999 })).toEqual({
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });
    expect(
      createPlainDateTime({
        year: 0,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      }),
    ).toEqual({
      year: 0,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    expect(createExactDuration(-10)).toEqual({ milliseconds: -10 });
    expect(createCalendarDuration({ years: -1, months: -2, weeks: 0, days: -3 })).toEqual({
      years: -1,
      months: -2,
      weeks: 0,
      days: -3,
    });
    expect(createCalendarDuration({ years: 0, months: 0, weeks: 0, days: 0 })).toEqual({
      years: 0,
      months: 0,
      weeks: 0,
      days: 0,
    });
  });

  it("handles Gregorian leap years and month lengths", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2023, 4)).toBe(30);
    expect(daysInMonth(2023, 1)).toBe(31);
  });

  it("converts Date values without retaining mutability", () => {
    const date = new Date("2026-08-10T12:00:00.000Z");
    const instant = instantFromDate(date);
    date.setTime(0);
    expect(instant.epochMilliseconds).toBe(1_786_363_200_000);
    const cloned = instantToDate(instant);
    expect(cloned.toISOString()).toBe("2026-08-10T12:00:00.000Z");
  });

  it("rejects wrong shapes, types, ranges, and mixed signs", () => {
    expectDateTimeError(() => createInstant(1.5), "INVALID_TYPE");
    expectDateTimeError(() => createInstant(Number.MAX_SAFE_INTEGER), "OUT_OF_RANGE");
    expectDateTimeError(() => createInstant(253_402_300_800_000), "OUT_OF_RANGE");
    expectDateTimeError(() => instantFromDate(new Date(Number.NaN)), "OUT_OF_RANGE");
    expectDateTimeError(() => instantFromDate("x" as never), "INVALID_TYPE");
    expectDateTimeError(() => createPlainDate({ year: 2024, month: 2, day: 30 }), "OUT_OF_RANGE");
    expectDateTimeError(() => createPlainDate({ year: -1, month: 1, day: 1 }), "OUT_OF_RANGE");
    expectDateTimeError(() => createPlainDate({ year: 2024, month: 13, day: 1 }), "OUT_OF_RANGE");
    expectDateTimeError(
      () => createPlainTime({ hour: 24, minute: 0, second: 0, millisecond: 0 }),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => createPlainTime({ hour: 0, minute: 60, second: 0, millisecond: 0 }),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => createPlainTime({ hour: 0, minute: 0, second: 60, millisecond: 0 }),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => createPlainTime({ hour: 0, minute: 0, second: 0, millisecond: 1000 }),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => createCalendarDuration({ years: 1, months: -1, weeks: 0, days: 0 }),
      "INVALID_RECORD",
    );
    expectDateTimeError(
      () => createPlainDate({ year: 2024, month: 1, day: 1, extra: true } as never),
      "INVALID_RECORD",
    );
    expectDateTimeError(() => createPlainDate(null as never), "INVALID_TYPE");
    expectDateTimeError(
      () => createZonedDateTime({ epochMilliseconds: 0, timeZone: 1 as never }),
      "INVALID_TYPE",
    );
    expectDateTimeError(
      () =>
        createZonedDateTime({ epochMilliseconds: -31_536_000_000, timeZone: "America/New_York" }),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () =>
        createZonedDateTime({
          epochMilliseconds: 1_786_363_200_000,
          timeZone: "Mars/Olympus",
        }),
      "INVALID_ZONE",
    );
  });
});
