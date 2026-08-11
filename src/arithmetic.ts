import { fail } from "./errors.js";
import type {
  CalendarArithmeticOptions,
  CalendarDuration,
  ExactDuration,
  Instant,
  PlainDate,
  PlainDateTime,
  ZonedDateTime,
} from "./types.js";
import {
  assertCalendarDuration,
  assertExactDuration,
  assertInstant,
  assertPlainDate,
  assertPlainDateTime,
  assertZonedDateTime,
  createExactDuration,
  createInstant,
  createPlainDate,
  createPlainDateTime,
  daysInMonth,
  epochFromUtcFields,
  plainDateTimeFromUtcEpoch,
} from "./values.js";
import { projectInstant, resolveZonedDateTime, zonedDateTimeFromInstant } from "./zones.js";

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) fail("OVERFLOW", "Arithmetic exceeds safe integer range");
  return result;
}

function negate(value: number): number {
  if (value === Number.MIN_SAFE_INTEGER) fail("OVERFLOW", "Duration cannot be negated safely");
  return -value;
}

function negateCalendar(value: CalendarDuration): CalendarDuration {
  return {
    years: negate(value.years),
    months: negate(value.months),
    weeks: negate(value.weeks),
    days: negate(value.days),
  };
}

function overflowOption(options?: CalendarArithmeticOptions): "reject" | "constrain" {
  const value = options?.overflow ?? "reject";
  if (value !== "reject" && value !== "constrain") {
    fail("INVALID_OPTION", `Unsupported overflow option: ${String(value)}`);
  }
  return value;
}

function calendarDate(
  input: PlainDate,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): PlainDate {
  const date = assertPlainDate({ year: input.year, month: input.month, day: input.day });
  const delta = assertCalendarDuration(duration);
  const overflow = overflowOption(options);
  const totalMonths = date.year * 12 + (date.month - 1) + delta.years * 12 + delta.months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const maximumDay =
    targetYear >= 0 && targetYear <= 9999 ? daysInMonth(targetYear, targetMonth) : 0;
  let targetDay = date.day;
  if (targetDay > maximumDay) {
    if (overflow === "reject") fail("OVERFLOW", "Day does not exist in target month");
    targetDay = maximumDay;
  }
  const midnight = epochFromUtcFields({
    year: targetYear,
    month: targetMonth,
    day: targetDay,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const dayDelta = safeAdd(delta.weeks * 7, delta.days);
  const result = plainDateTimeFromUtcEpoch(safeAdd(midnight, dayDelta * 86_400_000));
  return createPlainDate({ year: result.year, month: result.month, day: result.day });
}

export function addExactToInstant(value: Instant, duration: ExactDuration): Instant {
  const instant = assertInstant(value);
  const exact = assertExactDuration(duration);
  return createInstant(safeAdd(instant.epochMilliseconds, exact.milliseconds));
}

export function subtractExactFromInstant(value: Instant, duration: ExactDuration): Instant {
  const exact = assertExactDuration(duration);
  return addExactToInstant(value, createExactDuration(negate(exact.milliseconds)));
}

export function addExactToZonedDateTime(
  value: ZonedDateTime,
  duration: ExactDuration,
): ZonedDateTime {
  const zoned = assertZonedDateTime(value);
  const result = addExactToInstant({ epochMilliseconds: zoned.epochMilliseconds }, duration);
  return zonedDateTimeFromInstant(result, zoned.timeZone);
}

export function subtractExactFromZonedDateTime(
  value: ZonedDateTime,
  duration: ExactDuration,
): ZonedDateTime {
  const exact = assertExactDuration(duration);
  return addExactToZonedDateTime(value, createExactDuration(negate(exact.milliseconds)));
}

export function addCalendarToPlainDate(
  value: PlainDate,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): PlainDate {
  return calendarDate(value, duration, options);
}

export function subtractCalendarFromPlainDate(
  value: PlainDate,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): PlainDate {
  return calendarDate(value, negateCalendar(assertCalendarDuration(duration)), options);
}

export function addCalendarToPlainDateTime(
  value: PlainDateTime,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): PlainDateTime {
  const plain = assertPlainDateTime(value);
  const date = calendarDate(plain, duration, options);
  return createPlainDateTime({
    ...date,
    hour: plain.hour,
    minute: plain.minute,
    second: plain.second,
    millisecond: plain.millisecond,
  });
}

export function subtractCalendarFromPlainDateTime(
  value: PlainDateTime,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): PlainDateTime {
  return addCalendarToPlainDateTime(
    value,
    negateCalendar(assertCalendarDuration(duration)),
    options,
  );
}

export function addCalendarToZonedDateTime(
  value: ZonedDateTime,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): ZonedDateTime {
  const zoned = assertZonedDateTime(value);
  const plain = projectInstant(zoned.epochMilliseconds, zoned.timeZone);
  const moved = addCalendarToPlainDateTime(plain, duration, options);
  return resolveZonedDateTime(moved, zoned.timeZone, options);
}

export function subtractCalendarFromZonedDateTime(
  value: ZonedDateTime,
  duration: CalendarDuration,
  options?: CalendarArithmeticOptions,
): ZonedDateTime {
  return addCalendarToZonedDateTime(
    value,
    negateCalendar(assertCalendarDuration(duration)),
    options,
  );
}

export function differenceInstants(start: Instant, end: Instant): ExactDuration {
  const left = assertInstant(start);
  const right = assertInstant(end);
  return createExactDuration(right.epochMilliseconds - left.epochMilliseconds);
}

export function differenceZonedDateTimes(start: ZonedDateTime, end: ZonedDateTime): ExactDuration {
  const left = assertZonedDateTime(start);
  const right = assertZonedDateTime(end);
  return differenceInstants(
    { epochMilliseconds: left.epochMilliseconds },
    { epochMilliseconds: right.epochMilliseconds },
  );
}

function compareNumbers(left: number, right: number): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareInstants(left: Instant, right: Instant): -1 | 0 | 1 {
  return compareNumbers(
    assertInstant(left).epochMilliseconds,
    assertInstant(right).epochMilliseconds,
  );
}

export function compareZonedDateTimes(left: ZonedDateTime, right: ZonedDateTime): -1 | 0 | 1 {
  return compareNumbers(
    assertZonedDateTime(left).epochMilliseconds,
    assertZonedDateTime(right).epochMilliseconds,
  );
}

export function equalInstants(left: Instant, right: Instant): boolean {
  return compareInstants(left, right) === 0;
}

export function equalZonedDateTimes(left: ZonedDateTime, right: ZonedDateTime): boolean {
  const first = assertZonedDateTime(left);
  const second = assertZonedDateTime(right);
  return first.epochMilliseconds === second.epochMilliseconds && first.timeZone === second.timeZone;
}
