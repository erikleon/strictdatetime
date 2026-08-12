import { expect } from "vitest";
import { DateTimeError, type DateTimeErrorCode } from "../src/index.js";

/** Narrows away `undefined` from optional results and array indexing under `noUncheckedIndexedAccess`. */
export function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected a defined value");
  return value;
}

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
