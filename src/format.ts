import { intlFormatterCache } from "./cache.js";
import { fail } from "./errors.js";
import type { FormatOptions, Instant, ZonedDateTime } from "./types.js";
import { assertInstant, assertZonedDateTime } from "./values.js";
import { normalizeTimeZone, zonedDateTimeFromInstant } from "./zones.js";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function formatter(timeZone: string, format?: FormatOptions): Intl.DateTimeFormat {
  const options = format?.options ?? {};
  if (options.timeZone !== undefined && options.timeZone !== timeZone) {
    fail("INVALID_OPTION", "timeZone must be supplied through the value or function argument");
  }
  const locales = format?.locales;
  const key = `format:${stable(locales)}:${timeZone}:${stable(options)}`;
  const cached = intlFormatterCache.get(key);
  if (cached) return cached;
  try {
    const created = new Intl.DateTimeFormat(locales, { ...options, timeZone });
    intlFormatterCache.set(key, created);
    return created;
  } catch (error) {
    fail("INVALID_OPTION", "Invalid Intl.DateTimeFormat options", { cause: String(error) });
  }
}

export function formatInstant(value: Instant, timeZone: string, format?: FormatOptions): string {
  const instant = assertInstant(value);
  const zone = normalizeTimeZone(timeZone);
  zonedDateTimeFromInstant(instant, zone);
  return formatter(zone, format).format(new Date(instant.epochMilliseconds));
}

export function formatZonedDateTime(value: ZonedDateTime, format?: FormatOptions): string {
  const zoned = assertZonedDateTime(value);
  const normalized = zonedDateTimeFromInstant(
    { epochMilliseconds: zoned.epochMilliseconds },
    zoned.timeZone,
  );
  return formatter(normalized.timeZone, format).format(new Date(normalized.epochMilliseconds));
}
