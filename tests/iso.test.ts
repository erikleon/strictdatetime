import { describe, expect, it } from "vitest";
import {
  createInstant,
  parseInstant,
  parsePlainDate,
  parsePlainDateTime,
  parsePlainTime,
  parseZonedDateTime,
  toInstantString,
  toPlainDateString,
  toPlainDateTimeString,
  toPlainTimeString,
  toZonedDateTimeString,
} from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

describe("strict ISO profiles", () => {
  it("round-trips each plain and instant profile", () => {
    expect(toPlainDateString(parsePlainDate("2024-02-29"))).toBe("2024-02-29");
    expect(toPlainTimeString(parsePlainTime("01:02:03.4"))).toBe("01:02:03.400");
    expect(toPlainDateTimeString(parsePlainDateTime("2026-08-10T12:34:56.123000"))).toBe(
      "2026-08-10T12:34:56.123",
    );
    expect(toInstantString(parseInstant("2026-08-10T08:34:56.123-04:00"))).toBe(
      "2026-08-10T12:34:56.123Z",
    );
    expect(toInstantString(parseInstant("2026-08-10T12:34:56Z"))).toBe("2026-08-10T12:34:56.000Z");
  });

  it("accepts HH:MM without seconds in plain times only", () => {
    expect(toPlainTimeString(parsePlainTime("02:30"))).toBe("02:30:00.000");
    expect(toPlainDateTimeString(parsePlainDateTime("2026-03-08T02:30"))).toBe(
      "2026-03-08T02:30:00.000",
    );
    for (const input of ["02:30:", "02:30.123", "2:30", "02:3", "0230", "02:30:0"]) {
      expectDateTimeError(() => parsePlainTime(input), "INVALID_ISO");
      expectDateTimeError(() => parsePlainDateTime(`2026-03-08T${input}`), "INVALID_ISO");
    }
    expectDateTimeError(() => parsePlainTime("24:00"), "OUT_OF_RANGE");
    expectDateTimeError(() => parseInstant("2026-03-08T02:30Z"), "INVALID_ISO");
    expectDateTimeError(
      () => parseZonedDateTime("2026-03-08T02:30-05:00[America/New_York]"),
      "INVALID_ISO",
    );
  });

  it("parses and serializes the zoned subset", () => {
    const value = parseZonedDateTime("2026-08-10T08:34:56.123-04:00[America/New_York]");
    expect(toZonedDateTimeString(value)).toBe("2026-08-10T08:34:56.123-04:00[America/New_York]");
    expect(toZonedDateTimeString(parseZonedDateTime("2026-08-10T12:34:56.000+00:00[UTC]"))).toBe(
      "2026-08-10T12:34:56.000+00:00[UTC]",
    );
  });

  it("applies explicit offset conflict policies", () => {
    const input = "2026-08-10T08:34:56.000-05:00[America/New_York]";
    expectDateTimeError(() => parseZonedDateTime(input), "OFFSET_MISMATCH");
    const use = parseZonedDateTime(input, { offset: "use" });
    expect(toInstantString(createInstant(use.epochMilliseconds))).toBe("2026-08-10T13:34:56.000Z");
    const ignore = parseZonedDateTime(input, { offset: "ignore" });
    expect(toInstantString(createInstant(ignore.epochMilliseconds))).toBe(
      "2026-08-10T12:34:56.000Z",
    );
    const prefer = parseZonedDateTime(input, { offset: "prefer" });
    expect(toInstantString(createInstant(prefer.epochMilliseconds))).toBe(
      "2026-08-10T12:34:56.000Z",
    );
  });

  it("rejects malformed, unsupported, and precision-losing input", () => {
    for (const input of ["2026-1-01", "2026-01-01Z", "not-a-date"]) {
      expectDateTimeError(() => parseInstant(input), "INVALID_ISO");
    }
    expectDateTimeError(() => parseInstant("2026-01-01T24:00:00Z"), "OUT_OF_RANGE");
    expectDateTimeError(() => parsePlainDate("2023-02-29"), "OUT_OF_RANGE");
    expectDateTimeError(() => parsePlainTime("12:00:00.0001"), "PRECISION_LOSS");
    expectDateTimeError(() => parseInstant("2026-01-01T00:00:00+24:00"), "INVALID_ISO");
    expectDateTimeError(
      () => parseZonedDateTime("2026-01-01T00:00:00.000Z[America/New_York][u-ca=iso8601]"),
      "INVALID_ISO",
    );
    expectDateTimeError(() => parsePlainDate(1 as never), "INVALID_TYPE");
    expectDateTimeError(
      () => parseZonedDateTime("2026-01-01T00:00:00.000Z[UTC]", { offset: "bad" as never }),
      "INVALID_OPTION",
    );
  });
});
