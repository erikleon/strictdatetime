# TODOs

## Compound calendar differences

**What:** Add Temporal-compatible balanced zoned differences in a later 1.x release.
**Why:** Users need years-through-milliseconds spans, but balancing and relative rounding form a
separate calendar subsystem.
**Context:** Version 1.0 ships exact differences and exact/calendar add and subtract. The future
design requires termination proofs, sign and add-back invariants, rounding tables, and independent
conformance vectors.
**Depends on:** Stable 1.0 values, zone resolution, and calendar arithmetic.

## Interval difference

**What:** Add subtraction of one range from another, returning the zero, one, or two ranges that
remain.
**Why:** 1.2 ships intersection, gap, and merge, so the remaining set operation is the one that can
split a single range in two. Availability code wants free time as "the working day minus the
meetings", which is difference over a merged list.
**Context:** The return shape is the open question. Difference over a list is closed under the same
minimal disjoint form `mergeInstantIntervals` already produces, so it likely returns an array and
reuses that normalization rather than an ad-hoc tuple.
**Depends on:** Stable 1.2 intersection and merge semantics.

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
