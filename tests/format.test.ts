import { describe, expect, it } from "vitest";
import { intlFormatterCache, LruCache } from "../src/cache.js";
import {
  formatInstant,
  formatZonedDateTime,
  parseInstant,
  zonedDateTimeFromInstant,
} from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

describe("formatting and caches", () => {
  it("formats instants and zoned values through explicit zones", () => {
    const instant = parseInstant("2026-08-10T12:00:00.000Z");
    expect(
      formatInstant(instant, "UTC", {
        locales: "en-US",
        options: { year: "numeric", month: "2-digit", day: "2-digit" },
      }),
    ).toBe("08/10/2026");
    const zoned = zonedDateTimeFromInstant(instant, "America/New_York");
    expect(
      formatZonedDateTime(zoned, {
        locales: "en-US",
        options: { hour: "numeric", minute: "2-digit", hourCycle: "h12" },
      }),
    ).toBe("8:00 AM");
  });

  it("reuses canonical formatter keys and rejects overrides", () => {
    intlFormatterCache.clear();
    const instant = parseInstant("2026-08-10T12:00:00.000Z");
    formatInstant(instant, "UTC", { options: { month: "long", year: "numeric" } });
    const size = intlFormatterCache.size;
    formatInstant(instant, "UTC", { options: { year: "numeric", month: "long" } });
    expect(intlFormatterCache.size).toBe(size);
    expect(
      formatInstant(instant, "UTC", {
        locales: ["en-US", "fr-FR"],
        options: { year: "numeric" },
      }),
    ).toBe("2026");
    expectDateTimeError(
      () => formatInstant(instant, "UTC", { options: { timeZone: "Asia/Tokyo" } }),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () => formatInstant(instant, "UTC", { locales: "not_a_locale" }),
      "INVALID_OPTION",
    );
  });

  it("evicts least recently used cache entries", () => {
    const cache = new LruCache<number, string>(2);
    expect(cache.get(1)).toBeUndefined();
    cache.set(1, "one");
    cache.set(2, "two");
    expect(cache.get(1)).toBe("one");
    cache.set(3, "three");
    expect(cache.get(2)).toBeUndefined();
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
