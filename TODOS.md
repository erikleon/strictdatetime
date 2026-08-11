# TODOs

## Compound calendar differences

**What:** Add Temporal-compatible balanced zoned differences in a later 1.x release.
**Why:** Users need years-through-milliseconds spans, but balancing and relative rounding form a
separate calendar subsystem.
**Context:** Version 1.0 ships exact differences and exact/calendar add and subtract. The future
design requires termination proofs, sign and add-back invariants, rounding tables, and independent
conformance vectors.
**Depends on:** Stable 1.0 values, zone resolution, and calendar arithmetic.

## Interval and boundary utilities

**What:** Add interval records, containment/overlap, clamp, min/max, and start/end-of-unit helpers.
**Why:** Remove repeated application glue while reusing core comparison and arithmetic semantics.
**Context:** Design this as one coherent convenience family rather than disconnected helpers.
**Depends on:** Stable comparison, overflow, and arithmetic behavior.

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
