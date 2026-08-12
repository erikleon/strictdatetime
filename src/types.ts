export interface Instant {
  readonly epochMilliseconds: number;
}

export interface PlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface PlainTime {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

export interface PlainDateTime extends PlainDate, PlainTime {}

export interface ZonedDateTime {
  readonly epochMilliseconds: number;
  readonly timeZone: string;
}

export interface ExactDuration {
  readonly milliseconds: number;
}

export interface CalendarDuration {
  readonly years: number;
  readonly months: number;
  readonly weeks: number;
  readonly days: number;
}

/** Half-open range `[start, end)`. Endpoints are ordered; `start === end` is an empty range. */
export interface InstantInterval {
  readonly start: Instant;
  readonly end: Instant;
}

/** Half-open range `[start, end)`. Both endpoints carry the same normalized zone. */
export interface ZonedDateTimeInterval {
  readonly start: ZonedDateTime;
  readonly end: ZonedDateTime;
}

export type IntervalUnit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";

/** ISO weekday number for the first day of a week: Monday is 1, Sunday is 7. */
export type WeekStart = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Disambiguation = "reject" | "compatible" | "earlier" | "later";
export type Overflow = "reject" | "constrain";
export type OffsetPolicy = "reject" | "use" | "prefer" | "ignore";

export interface ResolutionOptions {
  readonly disambiguation?: Disambiguation;
}

export interface CalendarArithmeticOptions extends ResolutionOptions {
  readonly overflow?: Overflow;
}

export interface ZonedParseOptions extends ResolutionOptions {
  readonly offset?: OffsetPolicy;
}

export interface UnitBoundaryOptions {
  readonly weekStart?: WeekStart;
}

export interface ZonedUnitBoundaryOptions extends UnitBoundaryOptions, ResolutionOptions {}

export interface FormatOptions {
  readonly locales?: Intl.LocalesArgument;
  readonly options?: Intl.DateTimeFormatOptions;
}
