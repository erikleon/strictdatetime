import { intlFormatterCache } from "./cache.js";
import { fail } from "./errors.js";
import type {
  Disambiguation,
  Instant,
  PlainDateTime,
  ResolutionOptions,
  ZonedDateTime,
} from "./types.js";
import {
  assertInstant,
  assertPlainDateTime,
  assertZonedDateTime,
  createZonedDateTime,
  epochFromUtcFields,
  MIN_IANA_YEAR,
} from "./values.js";

const FIXED_ZONE = /^([+-])(\d{2}):(\d{2})$/;
const PROBE_DELTAS = [
  -172_800_000, -86_400_000, -21_600_000, 0, 21_600_000, 86_400_000, 172_800_000,
];

function parseFixedOffset(zone: string): number | undefined {
  if (zone === "UTC" || zone === "Z") return 0;
  const match = FIXED_ZONE.exec(zone);
  if (!match) return undefined;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) fail("INVALID_ZONE", `Invalid fixed-offset zone: ${zone}`);
  const magnitude = (hours * 60 + minutes) * 60_000;
  return match[1] === "-" ? -magnitude : magnitude;
}

export function normalizeTimeZone(zone: string): string {
  if (typeof zone !== "string" || zone.length === 0) {
    fail("INVALID_ZONE", "timeZone must be a non-empty string");
  }
  const fixed = parseFixedOffset(zone);
  if (fixed !== undefined) {
    if (fixed === 0) return "UTC";
    const sign = fixed < 0 ? "-" : "+";
    const absoluteMinutes = Math.abs(fixed) / 60_000;
    return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, "0")}:${String(absoluteMinutes % 60).padStart(2, "0")}`;
  }
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    fail("INVALID_ZONE", `Unsupported time zone: ${zone}`);
  }
}

function zoneFormatter(zone: string): Intl.DateTimeFormat {
  const key = `zone:${zone}`;
  const cached = intlFormatterCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  intlFormatterCache.set(key, formatter);
  return formatter;
}

function assertIanaRange(epochMilliseconds: number): void {
  const year = new Date(epochMilliseconds).getUTCFullYear();
  if (year < MIN_IANA_YEAR) {
    fail("OUT_OF_RANGE", "Named IANA time-zone operations require years 1970-9999");
  }
}

export function projectInstant(epochMilliseconds: number, timeZone: string): PlainDateTime {
  const instant = assertInstant({ epochMilliseconds });
  const zone = normalizeTimeZone(timeZone);
  const fixed = parseFixedOffset(zone);
  if (fixed !== undefined) {
    const projected = new Date(instant.epochMilliseconds + fixed);
    return Object.freeze({
      year: projected.getUTCFullYear(),
      month: projected.getUTCMonth() + 1,
      day: projected.getUTCDate(),
      hour: projected.getUTCHours(),
      minute: projected.getUTCMinutes(),
      second: projected.getUTCSeconds(),
      millisecond: projected.getUTCMilliseconds(),
    });
  }
  assertIanaRange(instant.epochMilliseconds);
  const fields: Record<string, number> = {};
  for (const part of zoneFormatter(zone).formatToParts(new Date(instant.epochMilliseconds))) {
    if (part.type !== "literal" && part.type !== "dayPeriod")
      fields[part.type] = Number(part.value);
  }
  return Object.freeze({
    year: fields.year as number,
    month: fields.month as number,
    day: fields.day as number,
    hour: fields.hour as number,
    minute: fields.minute as number,
    second: fields.second as number,
    millisecond: new Date(instant.epochMilliseconds).getUTCMilliseconds(),
  });
}

export function offsetMillisecondsAt(epochMilliseconds: number, timeZone: string): number {
  const zone = normalizeTimeZone(timeZone);
  const fixed = parseFixedOffset(zone);
  if (fixed !== undefined) return fixed;
  const projected = projectInstant(epochMilliseconds, zone);
  return epochFromUtcFields(projected) - epochMilliseconds;
}

function sameFields(left: PlainDateTime, right: PlainDateTime): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second &&
    left.millisecond === right.millisecond
  );
}

function arrayValue(values: readonly number[], index: number): number {
  const value = values[index];
  /* v8 ignore next -- callers prove candidate length before indexing */
  if (value === undefined) fail("UNSUPPORTED_TRANSITION", "Expected candidate is missing");
  return value;
}

function disambiguation(options?: ResolutionOptions): Disambiguation {
  const value = options?.disambiguation ?? "reject";
  if (value !== "reject" && value !== "compatible" && value !== "earlier" && value !== "later") {
    fail("INVALID_OPTION", `Unsupported disambiguation: ${String(value)}`);
  }
  return value;
}

export function resolveZonedDateTime(
  plainDateTime: PlainDateTime,
  timeZone: string,
  options?: ResolutionOptions,
): ZonedDateTime {
  const plain = assertPlainDateTime(plainDateTime);
  const zone = normalizeTimeZone(timeZone);
  if (parseFixedOffset(zone) === undefined && plain.year < MIN_IANA_YEAR) {
    fail("OUT_OF_RANGE", "Named IANA time-zone operations require years 1970-9999");
  }
  const policy = disambiguation(options);
  const naive = epochFromUtcFields(plain);
  const fixed = parseFixedOffset(zone);
  if (fixed !== undefined)
    return createZonedDateTime({ epochMilliseconds: naive - fixed, timeZone: zone });

  const offsets = new Set<number>();
  for (const delta of PROBE_DELTAS) offsets.add(offsetMillisecondsAt(naive + delta, zone));
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((candidate) => sameFields(projectInstant(candidate, zone), plain));
  const unique = [...new Set(candidates)].sort((a, b) => a - b);
  if (unique.length === 1) {
    return createZonedDateTime({ epochMilliseconds: arrayValue(unique, 0), timeZone: zone });
  }
  if (unique.length === 2) {
    if (policy === "reject") fail("AMBIGUOUS_TIME", "Wall time occurs twice in this time zone");
    const selected = arrayValue(unique, policy === "later" ? 1 : 0);
    return createZonedDateTime({ epochMilliseconds: selected, timeZone: zone });
  }
  /* v8 ignore next -- IANA local times have at most two matching instants */
  if (unique.length > 2) {
    fail("UNSUPPORTED_TRANSITION", "Host time-zone data produced more than two candidates");
  }
  if (policy === "reject") fail("NONEXISTENT_TIME", "Wall time does not exist in this time zone");

  const shifted = [...offsets].map((offset) => naive - offset).sort((a, b) => a - b);
  /* v8 ignore next -- a gap necessarily exposes distinct before/after offsets */
  if (shifted.length < 2) {
    fail("UNSUPPORTED_TRANSITION", "Unable to derive both sides of the time-zone gap");
  }
  const selected = arrayValue(shifted, policy === "earlier" ? 0 : shifted.length - 1);
  return createZonedDateTime({ epochMilliseconds: selected, timeZone: zone });
}

export function zonedDateTimeFromInstant(instant: Instant, timeZone: string): ZonedDateTime {
  const value = assertInstant(instant);
  const zone = normalizeTimeZone(timeZone);
  if (parseFixedOffset(zone) === undefined) assertIanaRange(value.epochMilliseconds);
  projectInstant(value.epochMilliseconds, zone);
  return createZonedDateTime({ epochMilliseconds: value.epochMilliseconds, timeZone: zone });
}

export function withTimeZone(value: ZonedDateTime, timeZone: string): ZonedDateTime {
  const zoned = assertZonedDateTime(value);
  return zonedDateTimeFromInstant({ epochMilliseconds: zoned.epochMilliseconds }, timeZone);
}
