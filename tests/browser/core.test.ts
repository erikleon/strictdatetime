import { expect, test } from "vitest";
import {
  parseInstant,
  parsePlainDateTime,
  resolveZonedDateTime,
  toInstantString,
  toZonedDateTimeString,
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
