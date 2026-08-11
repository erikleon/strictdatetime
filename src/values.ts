import { fail } from "./errors.js";
import type {
  CalendarDuration,
  ExactDuration,
  Instant,
  PlainDate,
  PlainDateTime,
  PlainTime,
  ZonedDateTime,
} from "./types.js";

export const MIN_YEAR = 0;
export const MAX_YEAR = 9999;
export const MIN_IANA_YEAR = 1970;

type DataRecord = Record<string, unknown>;

function ownRecord(value: unknown, keys: readonly string[], name: string): DataRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("INVALID_TYPE", `${name} must be a record`);
  }
  const record = value as DataRecord;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("INVALID_RECORD", `${name} must contain exactly: ${expected.join(", ")}`);
  }
  return record;
}

function integer(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    fail("INVALID_TYPE", `${name} must be a safe integer`);
  }
  return value;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function validateDateFields(yearValue: unknown, monthValue: unknown, dayValue: unknown): PlainDate {
  const year = integer(yearValue, "year");
  const month = integer(monthValue, "month");
  const day = integer(dayValue, "day");
  if (year < MIN_YEAR || year > MAX_YEAR) fail("OUT_OF_RANGE", "year must be 0000-9999");
  if (month < 1 || month > 12) fail("OUT_OF_RANGE", "month must be 1-12");
  if (day < 1 || day > daysInMonth(year, month)) {
    fail("OUT_OF_RANGE", "day is outside the selected month");
  }
  return { year, month, day };
}

function validateTimeFields(
  hourValue: unknown,
  minuteValue: unknown,
  secondValue: unknown,
  millisecondValue: unknown,
): PlainTime {
  const hour = integer(hourValue, "hour");
  const minute = integer(minuteValue, "minute");
  const second = integer(secondValue, "second");
  const millisecond = integer(millisecondValue, "millisecond");
  if (hour < 0 || hour > 23) fail("OUT_OF_RANGE", "hour must be 0-23");
  if (minute < 0 || minute > 59) fail("OUT_OF_RANGE", "minute must be 0-59");
  if (second < 0 || second > 59) fail("OUT_OF_RANGE", "second must be 0-59");
  if (millisecond < 0 || millisecond > 999) {
    fail("OUT_OF_RANGE", "millisecond must be 0-999");
  }
  return { hour, minute, second, millisecond };
}

export function createInstant(epochMilliseconds: number): Instant {
  const value = integer(epochMilliseconds, "epochMilliseconds");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail("OUT_OF_RANGE", "instant is outside the Date range");
  const year = date.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) fail("OUT_OF_RANGE", "instant year must be 0000-9999");
  return Object.freeze({ epochMilliseconds: value });
}

export function assertInstant(value: unknown): Instant {
  const record = ownRecord(value, ["epochMilliseconds"], "Instant");
  return createInstant(integer(record.epochMilliseconds, "epochMilliseconds"));
}

export function instantFromDate(value: Date): Instant {
  if (!(value instanceof Date)) fail("INVALID_TYPE", "value must be a Date");
  if (Number.isNaN(value.getTime())) fail("OUT_OF_RANGE", "Date must be valid");
  return createInstant(value.getTime());
}

export function instantToDate(value: Instant): Date {
  return new Date(assertInstant(value).epochMilliseconds);
}

export function createPlainDate(fields: PlainDate): PlainDate {
  const record = ownRecord(fields, ["year", "month", "day"], "PlainDate");
  return Object.freeze(validateDateFields(record.year, record.month, record.day));
}

export function assertPlainDate(value: unknown): PlainDate {
  return createPlainDate(value as PlainDate);
}

export function createPlainTime(fields: PlainTime): PlainTime {
  const record = ownRecord(fields, ["hour", "minute", "second", "millisecond"], "PlainTime");
  return Object.freeze(
    validateTimeFields(record.hour, record.minute, record.second, record.millisecond),
  );
}

export function assertPlainTime(value: unknown): PlainTime {
  return createPlainTime(value as PlainTime);
}

export function createPlainDateTime(fields: PlainDateTime): PlainDateTime {
  const record = ownRecord(
    fields,
    ["year", "month", "day", "hour", "minute", "second", "millisecond"],
    "PlainDateTime",
  );
  const date = validateDateFields(record.year, record.month, record.day);
  const time = validateTimeFields(record.hour, record.minute, record.second, record.millisecond);
  return Object.freeze({ ...date, ...time });
}

export function assertPlainDateTime(value: unknown): PlainDateTime {
  return createPlainDateTime(value as PlainDateTime);
}

export function createZonedDateTime(fields: ZonedDateTime): ZonedDateTime {
  const record = ownRecord(fields, ["epochMilliseconds", "timeZone"], "ZonedDateTime");
  const instant = createInstant(integer(record.epochMilliseconds, "epochMilliseconds"));
  if (typeof record.timeZone !== "string") fail("INVALID_TYPE", "timeZone must be a string");
  const fixed = /^(?:Z|UTC|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(record.timeZone);
  if (!fixed) {
    if (new Date(instant.epochMilliseconds).getUTCFullYear() < MIN_IANA_YEAR) {
      fail("OUT_OF_RANGE", "Named IANA time-zone operations require years 1970-9999");
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: record.timeZone });
    } catch {
      fail("INVALID_ZONE", `Unsupported time zone: ${record.timeZone}`);
    }
  }
  return Object.freeze({ epochMilliseconds: instant.epochMilliseconds, timeZone: record.timeZone });
}

export function assertZonedDateTime(value: unknown): ZonedDateTime {
  return createZonedDateTime(value as ZonedDateTime);
}

export function createExactDuration(milliseconds: number): ExactDuration {
  return Object.freeze({ milliseconds: integer(milliseconds, "milliseconds") });
}

export function assertExactDuration(value: unknown): ExactDuration {
  const record = ownRecord(value, ["milliseconds"], "ExactDuration");
  return createExactDuration(integer(record.milliseconds, "milliseconds"));
}

export function createCalendarDuration(fields: CalendarDuration): CalendarDuration {
  const record = ownRecord(fields, ["years", "months", "weeks", "days"], "CalendarDuration");
  const values = {
    years: integer(record.years, "years"),
    months: integer(record.months, "months"),
    weeks: integer(record.weeks, "weeks"),
    days: integer(record.days, "days"),
  };
  const signs = Object.values(values)
    .filter((value) => value !== 0)
    .map(Math.sign);
  if (signs.some((sign) => sign !== signs[0])) {
    fail("INVALID_RECORD", "CalendarDuration fields must have the same sign");
  }
  return Object.freeze(values);
}

export function assertCalendarDuration(value: unknown): CalendarDuration {
  return createCalendarDuration(value as CalendarDuration);
}

export function epochFromUtcFields(fields: PlainDateTime): number {
  const value = createPlainDateTime(fields);
  const date = new Date(0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  date.setUTCHours(value.hour, value.minute, value.second, value.millisecond);
  return date.getTime();
}

export function plainDateTimeFromUtcEpoch(epochMilliseconds: number): PlainDateTime {
  const date = new Date(epochMilliseconds);
  return createPlainDateTime({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  });
}
