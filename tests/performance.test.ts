import { describe, expect, it } from "vitest";
import { intlFormatterCache } from "../src/cache.js";
import { parsePlainDateTime, resolveZonedDateTime } from "../src/index.js";

describe("structural performance budgets", () => {
  it("keeps the Intl cache bounded", () => {
    intlFormatterCache.clear();
    const zones =
      typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    for (const zone of zones.slice(0, 180)) {
      resolveZonedDateTime(parsePlainDateTime("2026-01-15T12:00:00.000"), zone);
    }
    expect(intlFormatterCache.size).toBeLessThanOrEqual(128);
  });
});
