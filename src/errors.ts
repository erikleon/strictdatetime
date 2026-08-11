export const DATE_TIME_ERROR_CODES = [
  "INVALID_TYPE",
  "INVALID_RECORD",
  "INVALID_ISO",
  "INVALID_ZONE",
  "INVALID_OPTION",
  "OUT_OF_RANGE",
  "PRECISION_LOSS",
  "AMBIGUOUS_TIME",
  "NONEXISTENT_TIME",
  "OFFSET_MISMATCH",
  "OVERFLOW",
  "UNSUPPORTED_TRANSITION",
] as const;

export type DateTimeErrorCode = (typeof DATE_TIME_ERROR_CODES)[number];

export class DateTimeError extends Error {
  readonly code: DateTimeErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: DateTimeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "DateTimeError";
    this.code = code;
    this.details = details;
  }
}

export function isDateTimeError(value: unknown): value is DateTimeError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; code?: unknown };
  return (
    candidate.name === "DateTimeError" &&
    typeof candidate.code === "string" &&
    (DATE_TIME_ERROR_CODES as readonly string[]).includes(candidate.code)
  );
}

export function fail(
  code: DateTimeErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new DateTimeError(code, message, details);
}
