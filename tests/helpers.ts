import { expect } from "vitest";
import { DateTimeError, type DateTimeErrorCode } from "../src/index.js";

export function expectDateTimeError(action: () => unknown, code: DateTimeErrorCode): DateTimeError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DateTimeError);
    expect((error as DateTimeError).code).toBe(code);
    return error as DateTimeError;
  }
  throw new Error(`Expected DateTimeError ${code}`);
}
