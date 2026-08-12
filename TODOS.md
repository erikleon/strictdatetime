# TODOs

## Compound calendar differences

**What:** Add Temporal-compatible balanced zoned differences in a later 1.x release.
**Why:** Users need years-through-milliseconds spans, but balancing and relative rounding form a
separate calendar subsystem.
**Context:** Version 1.0 ships exact differences and exact/calendar add and subtract. The future
design requires termination proofs, sign and add-back invariants, rounding tables, and independent
conformance vectors.
**Depends on:** Stable 1.0 values, zone resolution, and calendar arithmetic.

## Subtracting a list of ranges

**What:** Add removal of many ranges from one range, returning what remains.
**Why:** Availability code wants free time as "the working day minus the meetings". 1.3 ships the
one-range primitive, but folding it over a list by hand is easy to get wrong: each step can split a
range, so the accumulator has to be re-normalized rather than carried as a single range.
**Context:** The result is the minimal disjoint form `mergeInstantIntervals` already produces, so
the implementation is merge over the removals followed by a fold of `instantIntervalDifference`.
The open question is naming, since the existing two-argument set operations read
`instantIntervalX(left, right)` and this one takes a range and a list.
**Depends on:** Stable 1.3 difference and merge semantics.

## Relative-time labels

**What:** Add `Intl.RelativeTimeFormat` output with explicit unit thresholds and rounding.
**Why:** User interfaces commonly need labels such as “in 3 days” without another dependency.
**Context:** Threshold and unit-selection policy must remain separate from deterministic core
formatting.
**Depends on:** Stable difference APIs and a dedicated product/API review.

## Recurrence research

**What:** Evaluate finite recurrence generation, potentially as a companion package.
**Why:** Recurring civil schedules need termination, invalid-date, DST, and resource-limit policies.
**Context:** Do not implement an unbounded iterator or treat recurrence as a small helper.
**Depends on:** Stable calendar arithmetic, interval types, and a fresh engineering review.
