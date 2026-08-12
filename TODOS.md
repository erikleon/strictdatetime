# TODOs

## Compound calendar differences

**What:** Add Temporal-compatible balanced zoned differences in a later 1.x release.
**Why:** Users need years-through-milliseconds spans, but balancing and relative rounding form a
separate calendar subsystem.
**Context:** Version 1.0 ships exact differences and exact/calendar add and subtract. The future
design requires termination proofs, sign and add-back invariants, rounding tables, and independent
conformance vectors.
**Depends on:** Stable 1.0 values, zone resolution, and calendar arithmetic.

## Interval intersection and union

**What:** Add intersection, gap, and merge operations over the interval records shipped in 1.1.
**Why:** Overlap answers whether two ranges collide; scheduling code then needs the collision
itself, and merging a sorted list is the next repeated piece of application glue.
**Context:** 1.1 deliberately shipped only what the original interval TODO listed. Union over a list
needs a defined sort and a decision on whether adjacent ranges merge, which the half-open
`[start, end)` semantics make answerable but should be settled explicitly.
**Depends on:** Stable 1.1 interval records and overlap semantics.

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
