import { describe, expect, it } from "vitest";
import {
  createInstant,
  normalizeTimeZone,
  parseInstant,
  parsePlainDate,
  parsePlainDateTime,
  projectInstant,
  resolveZonedDateTime,
  toInstantString,
  toZonedDateTimeString,
  withTimeZone,
  zonedDateTimeFromInstant,
  zonedDateTimeFromPlainDate,
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

describe("zonedDateTimeFromPlainDate", () => {
  const start = (date: string, zone: string) =>
    toZonedDateTimeString(zonedDateTimeFromPlainDate(parsePlainDate(date), zone));

  it("gives local midnight on an ordinary day", () => {
    expect(start("2026-09-24", "America/Los_Angeles")).toBe(
      "2026-09-24T00:00:00.000-07:00[America/Los_Angeles]",
    );
    expect(start("0001-01-01", "+05:30")).toBe("0001-01-01T00:00:00.000+05:30[+05:30]");
  });

  it("starts after a skipped midnight and at the first of a repeated one", () => {
    expect(start("2026-09-06", "America/Santiago")).toBe(
      "2026-09-06T01:00:00.000-03:00[America/Santiago]",
    );
    expect(start("2026-11-01", "America/Havana")).toBe(
      "2026-11-01T00:00:00.000-04:00[America/Havana]",
    );
  });

  it("rejects a date the zone skips entirely", () => {
    expectDateTimeError(
      () => zonedDateTimeFromPlainDate(parsePlainDate("2011-12-30"), "Pacific/Apia"),
      "NONEXISTENT_TIME",
    );
    expect(start("2011-12-31", "Pacific/Apia")).toBe("2011-12-31T00:00:00.000+14:00[Pacific/Apia]");
  });

  it("rejects invalid input", () => {
    expectDateTimeError(
      () => zonedDateTimeFromPlainDate(parsePlainDateTime("2026-09-24T00:00") as never, "UTC"),
      "INVALID_RECORD",
    );
    expectDateTimeError(
      () => zonedDateTimeFromPlainDate(parsePlainDate("1969-12-31"), "America/New_York"),
      "OUT_OF_RANGE",
    );
    expectDateTimeError(
      () => zonedDateTimeFromPlainDate(parsePlainDate("2026-09-24"), "Mars/Olympus"),
      "INVALID_ZONE",
    );
  });
});
