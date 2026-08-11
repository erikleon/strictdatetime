import { describe, expect, it } from "vitest";
import {
  createInstant,
  normalizeTimeZone,
  parseInstant,
  parsePlainDateTime,
  projectInstant,
  resolveZonedDateTime,
  toInstantString,
  toZonedDateTimeString,
  withTimeZone,
  zonedDateTimeFromInstant,
} from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

describe("time zones", () => {
  it("normalizes named and fixed zones", () => {
    expect(normalizeTimeZone("UTC")).toBe("UTC");
    expect(normalizeTimeZone("Z")).toBe("UTC");
    expectDateTimeError(() => normalizeTimeZone("+5:30"), "INVALID_ZONE");
    expect(normalizeTimeZone("+05:30")).toBe("+05:30");
    expect(normalizeTimeZone("-05:30")).toBe("-05:30");
    expect(normalizeTimeZone("-00:00")).toBe("UTC");
    expect(normalizeTimeZone("America/New_York")).toBe("America/New_York");
    expectDateTimeError(() => normalizeTimeZone(""), "INVALID_ZONE");
    expectDateTimeError(() => normalizeTimeZone("+24:00"), "INVALID_ZONE");
    expectDateTimeError(() => normalizeTimeZone("Mars/Olympus"), "INVALID_ZONE");
  });

  it("projects instants and changes display zone without changing the instant", () => {
    const instant = parseInstant("2026-08-10T12:00:00.123Z");
    expect(projectInstant(instant.epochMilliseconds, "+05:30")).toEqual({
      year: 2026,
      month: 8,
      day: 10,
      hour: 17,
      minute: 30,
      second: 0,
      millisecond: 123,
    });
    const ny = zonedDateTimeFromInstant(instant, "America/New_York");
    const tokyo = withTimeZone(ny, "Asia/Tokyo");
    expect(tokyo.epochMilliseconds).toBe(ny.epochMilliseconds);
    expect(toZonedDateTimeString(tokyo)).toBe("2026-08-10T21:00:00.123+09:00[Asia/Tokyo]");
  });

  it("resolves unique wall times", () => {
    const value = resolveZonedDateTime(
      parsePlainDateTime("2026-08-10T08:00:00.000"),
      "America/New_York",
    );
    expect(toInstantString(createInstant(value.epochMilliseconds))).toBe(
      "2026-08-10T12:00:00.000Z",
    );
    expect(
      toInstantString(
        createInstant(
          resolveZonedDateTime(parsePlainDateTime("2026-08-10T08:00:00.000"), "+05:30")
            .epochMilliseconds,
        ),
      ),
    ).toBe("2026-08-10T02:30:00.000Z");
  });

  it("handles DST gaps using explicit policies", () => {
    const plain = parsePlainDateTime("2026-03-08T02:30:00.000");
    expectDateTimeError(() => resolveZonedDateTime(plain, "America/New_York"), "NONEXISTENT_TIME");
    expect(
      toZonedDateTimeString(
        resolveZonedDateTime(plain, "America/New_York", { disambiguation: "earlier" }),
      ),
    ).toBe("2026-03-08T01:30:00.000-05:00[America/New_York]");
    expect(
      toZonedDateTimeString(
        resolveZonedDateTime(plain, "America/New_York", { disambiguation: "later" }),
      ),
    ).toBe("2026-03-08T03:30:00.000-04:00[America/New_York]");
    expect(
      toZonedDateTimeString(
        resolveZonedDateTime(plain, "America/New_York", { disambiguation: "compatible" }),
      ),
    ).toContain("T03:30:00.000");
  });

  it("handles DST overlaps using explicit policies", () => {
    const plain = parsePlainDateTime("2026-11-01T01:30:00.000");
    expectDateTimeError(() => resolveZonedDateTime(plain, "America/New_York"), "AMBIGUOUS_TIME");
    expect(
      toInstantString(
        createInstant(
          resolveZonedDateTime(plain, "America/New_York", { disambiguation: "earlier" })
            .epochMilliseconds,
        ),
      ),
    ).toBe("2026-11-01T05:30:00.000Z");
    expect(
      toInstantString(
        createInstant(
          resolveZonedDateTime(plain, "America/New_York", { disambiguation: "later" })
            .epochMilliseconds,
        ),
      ),
    ).toBe("2026-11-01T06:30:00.000Z");
    expect(
      toInstantString(
        createInstant(
          resolveZonedDateTime(plain, "America/New_York", { disambiguation: "compatible" })
            .epochMilliseconds,
        ),
      ),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects invalid policies and pre-1970 named-zone operations", () => {
    expectDateTimeError(
      () =>
        resolveZonedDateTime(parsePlainDateTime("2026-01-01T00:00:00.000"), "UTC", {
          disambiguation: "bad" as never,
        }),
      "INVALID_OPTION",
    );
    expectDateTimeError(
      () => resolveZonedDateTime(parsePlainDateTime("1969-01-01T00:00:00.000"), "America/New_York"),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => zonedDateTimeFromInstant(parseInstant("1969-01-01T00:00:00.000Z"), "America/New_York"),
      "OUT_OF_RANGE",
    );
  });
});
