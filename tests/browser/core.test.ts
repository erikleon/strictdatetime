import { expect, test } from "vitest";
import {
  parseInstant,
  parsePlainDateTime,
  resolveZonedDateTime,
  toInstantString,
  toZonedDateTimeString,
  zonedDateTimeIntervalDuration,
  zonedDateTimeUnitInterval,
} from "../../src/index.js";

test("runs the core package semantics in a browser", () => {
  expect(toInstantString(parseInstant("2026-08-10T12:00:00.000Z"))).toBe(
    "2026-08-10T12:00:00.000Z",
  );
  const value = resolveZonedDateTime(
    parsePlainDateTime("2026-08-10T08:00:00.000"),
    "America/New_York",
  );
  expect(toZonedDateTimeString(value)).toBe("2026-08-10T08:00:00.000-04:00[America/New_York]");
});

test("derives unit intervals from browser zone data", () => {
  const value = resolveZonedDateTime(
    parsePlainDateTime("2026-03-08T15:00:00.000"),
    "America/New_York",
  );
  const day = zonedDateTimeUnitInterval(value, "day");
  expect(toZonedDateTimeString(day.start)).toBe("2026-03-08T00:00:00.000-05:00[America/New_York]");
  expect(zonedDateTimeIntervalDuration(day).milliseconds).toBe(23 * 3_600_000);
});
