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

export interface FormatOptions {
  readonly locales?: Intl.LocalesArgument;
  readonly options?: Intl.DateTimeFormatOptions;
}
