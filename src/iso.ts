import { fail } from "./errors.js";
import type {
  Instant,
  PlainDate,
  PlainDateTime,
  PlainTime,
  ZonedDateTime,
  ZonedParseOptions,
} from "./types.js";
import {
  assertInstant,
  assertPlainDate,
  assertPlainDateTime,
  assertPlainTime,
  assertZonedDateTime,
  createInstant,
  createPlainDate,
  createPlainDateTime,
  createPlainTime,
  epochFromUtcFields,
} from "./values.js";
import {
  normalizeTimeZone,
  offsetMillisecondsAt,
  projectInstant,
  resolveZonedDateTime,
  zonedDateTimeFromInstant,
} from "./zones.js";

const DATE = "(\\d{4})-(\\d{2})-(\\d{2})";
const TIME = "(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d+))?";
const OFFSET = "(Z|[+-]\\d{2}:\\d{2})";
const DATE_RE = new RegExp(`^${DATE}$`);
const TIME_RE = new RegExp(`^${TIME}$`);
const DATE_TIME_RE = new RegExp(`^${DATE}T${TIME}$`);
const INSTANT_RE = new RegExp(`^${DATE}T${TIME}${OFFSET}$`);
const ZONED_RE = new RegExp(`^${DATE}T${TIME}${OFFSET}\\[([^\\[\\]!]+)\\]$`);

function milliseconds(fraction: string | undefined): number {
  if (!fraction) return 0;
  const tail = fraction.slice(3);
  if (tail && /[1-9]/.test(tail))
    fail("PRECISION_LOSS", "Precision beyond milliseconds is non-zero");
  return Number(fraction.slice(0, 3).padEnd(3, "0"));
}

function offsetMilliseconds(value: string): number {
  if (value === "Z") return 0;
  const sign = value[0] === "-" ? -1 : 1;
  const hours = Number(value.slice(1, 3));
  const minutes = Number(value.slice(4, 6));
  if (hours > 23 || minutes > 59) fail("INVALID_ISO", "Offset is outside ±23:59");
  return sign * (hours * 60 + minutes) * 60_000;
}

function dateFromMatch(match: RegExpExecArray, offset = 1): PlainDate {
  return createPlainDate({
    year: Number(match[offset]),
    month: Number(match[offset + 1]),
    day: Number(match[offset + 2]),
  });
}

function timeFromMatch(match: RegExpExecArray, offset: number): PlainTime {
  return createPlainTime({
    hour: Number(match[offset]),
    minute: Number(match[offset + 1]),
    second: Number(match[offset + 2]),
    millisecond: milliseconds(match[offset + 3]),
  });
}

function requireMatch(regex: RegExp, input: string, name: string): RegExpExecArray {
  if (typeof input !== "string") fail("INVALID_TYPE", `${name} input must be a string`);
  const match = regex.exec(input);
  if (!match) fail("INVALID_ISO", `Invalid ${name} string`);
  return match;
}

function capture(match: RegExpExecArray, index: number): string {
  const value = match[index];
  /* v8 ignore next -- guarded by a successful fixed-shape regular expression */
  if (value === undefined) fail("INVALID_ISO", "Required ISO component is missing");
  return value;
}

export function parsePlainDate(input: string): PlainDate {
  return dateFromMatch(requireMatch(DATE_RE, input, "PlainDate"));
}

export function parsePlainTime(input: string): PlainTime {
  return timeFromMatch(requireMatch(TIME_RE, input, "PlainTime"), 1);
}

export function parsePlainDateTime(input: string): PlainDateTime {
  const match = requireMatch(DATE_TIME_RE, input, "PlainDateTime");
  return createPlainDateTime({ ...dateFromMatch(match), ...timeFromMatch(match, 4) });
}

export function parseInstant(input: string): Instant {
  const match = requireMatch(INSTANT_RE, input, "Instant");
  const plain = createPlainDateTime({ ...dateFromMatch(match), ...timeFromMatch(match, 4) });
  return createInstant(epochFromUtcFields(plain) - offsetMilliseconds(capture(match, 8)));
}

export function parseZonedDateTime(input: string, options?: ZonedParseOptions): ZonedDateTime {
  const match = requireMatch(ZONED_RE, input, "ZonedDateTime");
  const plain = createPlainDateTime({ ...dateFromMatch(match), ...timeFromMatch(match, 4) });
  const suppliedOffset = offsetMilliseconds(capture(match, 8));
  const zone = normalizeTimeZone(capture(match, 9));
  const offsetPolicy = options?.offset ?? "reject";
  if (!["reject", "use", "prefer", "ignore"].includes(offsetPolicy)) {
    fail("INVALID_OPTION", `Unsupported offset policy: ${String(offsetPolicy)}`);
  }
  if (offsetPolicy === "ignore") return resolveZonedDateTime(plain, zone, options);
  const byOffset = epochFromUtcFields(plain) - suppliedOffset;
  const matchesZone =
    offsetMillisecondsAt(byOffset, zone) === suppliedOffset &&
    JSON.stringify(projectInstant(byOffset, zone)) === JSON.stringify(plain);
  if (matchesZone || offsetPolicy === "use") {
    return zonedDateTimeFromInstant(createInstant(byOffset), zone);
  }
  if (offsetPolicy === "prefer") return resolveZonedDateTime(plain, zone, options);
  fail("OFFSET_MISMATCH", "Numeric offset does not match the annotated time zone");
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function dateString(value: PlainDate): string {
  return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`;
}

function timeString(value: PlainTime): string {
  return `${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}.${pad(value.millisecond, 3)}`;
}

function offsetString(offset: number): string {
  if (offset === 0) return "+00:00";
  const sign = offset < 0 ? "-" : "+";
  const minutes = Math.abs(offset) / 60_000;
  return `${sign}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function toPlainDateString(value: PlainDate): string {
  return dateString(assertPlainDate(value));
}

export function toPlainTimeString(value: PlainTime): string {
  return timeString(assertPlainTime(value));
}

export function toPlainDateTimeString(value: PlainDateTime): string {
  const plain = assertPlainDateTime(value);
  return `${dateString(plain)}T${timeString(plain)}`;
}

export function toInstantString(value: Instant): string {
  return new Date(assertInstant(value).epochMilliseconds).toISOString();
}

export function toZonedDateTimeString(value: ZonedDateTime): string {
  const zoned = assertZonedDateTime(value);
  const normalized = zonedDateTimeFromInstant(
    { epochMilliseconds: zoned.epochMilliseconds },
    zoned.timeZone,
  );
  const plain = projectInstant(normalized.epochMilliseconds, normalized.timeZone);
  const offset = offsetMillisecondsAt(normalized.epochMilliseconds, normalized.timeZone);
  return `${dateString(plain)}T${timeString(plain)}${offsetString(offset)}[${normalized.timeZone}]`;
}
