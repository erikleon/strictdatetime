import { fail } from "./errors.js";
import type { Instant, Rfc5322ParseOptions } from "./types.js";
import { createInstant, createPlainDateTime, epochFromUtcFields } from "./values.js";

// RFC 5322 section 3.3, current (non-obsolete) grammar, after unfolding and collapsing whitespace:
//
//   [day-name "," [" "]] day " " month-name " " year " " hh ":" mm [":" ss] " " zone [comments]
//
// Names are matched without regard to case, as ABNF literals are.
const DATE_TIME_RE =
  /^(?:([a-z]{3}), ?)?(\d{1,2}) ([a-z]{3}) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? ([+-]\d{4}|[a-z]+)$/i;
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const OBSOLETE_ZONES: Readonly<Record<string, number>> = {
  ut: 0,
  gmt: 0,
  est: -5,
  edt: -4,
  cst: -6,
  cdt: -5,
  mst: -7,
  mdt: -6,
  pst: -8,
  pdt: -7,
};

function invalid(message: string): never {
  fail("INVALID_RFC5322", message);
}

/**
 * Removes the comments RFC 5322 allows after the zone, such as `(UTC)` or `(Pacific Standard
 * Time)`. Comments can nest and can escape a character with a backslash. A comment anywhere else is
 * obsolete syntax and is left in place, so the grammar check rejects it.
 */
function stripTrailingComments(value: string): string {
  const open = value.indexOf("(");
  if (open === -1) return value;
  let depth = 0;
  for (let index = open; index < value.length; index++) {
    const char = value[index];
    if (char === "\\" && depth > 0) index++;
    else if (char === "(") depth++;
    else if (char === ")") {
      if (depth === 0) invalid("Unbalanced comment parentheses");
      depth--;
    } else if (depth === 0 && char !== " ") invalid("Text after a trailing comment");
  }
  if (depth !== 0) invalid("Unclosed comment");
  return value.slice(0, open);
}

function zoneOffsetMinutes(zone: string, options: Rfc5322ParseOptions | undefined): number {
  if (zone[0] === "+" || zone[0] === "-") {
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(3, 5));
    if (hours > 23 || minutes > 59) invalid("Zone offset is outside ±2359");
    return (zone[0] === "-" ? -1 : 1) * (hours * 60 + minutes);
  }
  const hours = OBSOLETE_ZONES[zone.toLowerCase()];
  if (hours === undefined) invalid(`Unknown zone: ${zone}`);
  if (options?.allowObsoleteZones !== true) {
    invalid(`Obsolete zone name ${zone} needs allowObsoleteZones`);
  }
  return hours * 60;
}

/**
 * Parses an RFC 5322 date-time, the format of email `Date` headers, for example
 * `Mon, 16 Feb 2026 10:00:00 -0500`. Returns the instant it names. `-0000` ("time zone unknown")
 * names the same instant as `+0000`.
 *
 * Folded lines are unfolded and runs of spaces or tabs count as one space. Two-digit years, zones
 * without a numeric offset (unless `allowObsoleteZones`), comments before the zone, and the other
 * obsolete forms of RFC 5322 section 4.3 fail with INVALID_RFC5322. A day of the week that does not
 * match the date fails the same way; an impossible date or time fails with OUT_OF_RANGE.
 */
export function parseRfc5322DateTime(input: string, options?: Rfc5322ParseOptions): Instant {
  if (typeof input !== "string") fail("INVALID_TYPE", "RFC 5322 input must be a string");
  const allow = options?.allowObsoleteZones;
  if (allow !== undefined && typeof allow !== "boolean") {
    fail("INVALID_OPTION", "allowObsoleteZones must be a boolean");
  }
  const unfolded = input.replace(/\r\n(?=[ \t])/g, "");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(unfolded)) {
    invalid("Control character or bare line break");
  }
  const body = stripTrailingComments(unfolded.replace(/[ \t]+/g, " ")).trim();
  const match = DATE_TIME_RE.exec(body);
  if (!match) invalid("Invalid RFC 5322 date-time");
  const [, dayName, day, monthName, year, hour, minute, second, zone] = match as unknown as [
    string,
    string | undefined,
    string,
    string,
    string,
    string,
    string,
    string | undefined,
    string,
  ];

  const month = MONTH_NAMES.indexOf(monthName.toLowerCase()) + 1;
  if (month === 0) invalid(`Unknown month: ${monthName}`);
  if (Number(year) < 1900) fail("OUT_OF_RANGE", "RFC 5322 years start at 1900");
  const plain = createPlainDateTime({
    year: Number(year),
    month,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? 0),
    millisecond: 0,
  });
  const local = epochFromUtcFields(plain);
  if (dayName !== undefined) {
    const weekday = DAY_NAMES.indexOf(dayName.toLowerCase());
    if (weekday === -1) invalid(`Unknown day of the week: ${dayName}`);
    if (new Date(local).getUTCDay() !== weekday) {
      invalid(`${dayName} does not match the date`);
    }
  }
  return createInstant(local - zoneOffsetMinutes(zone, options) * 60_000);
}
