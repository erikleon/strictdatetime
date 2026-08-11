import { describe, expect, it } from "vitest";
import { DateTimeError, isDateTimeError } from "../src/index.js";

describe("DateTimeError", () => {
  it("uses stable structural codes", () => {
    const error = new DateTimeError("INVALID_ZONE", "bad zone", { zone: "Mars/Base" });
    expect(error.name).toBe("DateTimeError");
    expect(error.code).toBe("INVALID_ZONE");
    expect(error.details).toEqual({ zone: "Mars/Base" });
    expect(isDateTimeError(error)).toBe(true);
    expect(isDateTimeError({ name: "DateTimeError", code: "INVALID_ZONE" })).toBe(true);
    expect(isDateTimeError({ name: "DateTimeError", code: "UNKNOWN" })).toBe(false);
    expect(isDateTimeError(null)).toBe(false);
    expect(isDateTimeError("error")).toBe(false);
  });
});
