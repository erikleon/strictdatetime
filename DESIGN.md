# Design System — strictdatetime

## Product Context

- **What this is:** A compact marketing and documentation site for a strict JavaScript date and time library.
- **Who it's for:** JavaScript and TypeScript developers who want explicit date, time, and timezone behavior.
- **Project type:** Static open-source package site hosted on GitHub Pages.

## Aesthetic Direction

- **Direction:** Industrial editorial.
- **Decoration level:** Intentional.
- **Mood:** Precise, candid, and technical without feeling like generated API documentation.

## Typography

- **Display and body:** IBM Plex Sans for legible technical editorial hierarchy.
- **Code and labels:** IBM Plex Mono for commands, metadata, and examples.
- **Loading:** Google Fonts with preconnect hints; semantic fallbacks remain usable if unavailable.
- **Scale:** 12px labels, 14–17px UI/body, 24px subheads, 34–58px sections, 52–116px hero.

## Color

- **Approach:** Restrained warm neutral surfaces with one direct signal color.
- **Paper:** `#f4efe5`; **ink:** `#17211c`; **muted:** `#59635d`; **line:** `#c9c5b9`.
- **Signal:** `#da4b2f`; **signal dark:** `#ad351f`; **code panel:** `#1b2520`; **code accent:** `#cbe66b`.
- Maintain WCAG AA contrast for body text and controls.

## Spacing and Layout

- **Base unit:** 4px with comfortable density.
- **Approach:** Grid-disciplined editorial layout, maximum width 1120px.
- **Breakpoints:** Two-column desktop layouts collapse to a single column below 760px.
- **Edges:** Square controls and panels reinforce precision; avoid decorative rounded cards.

## Motion

- **Approach:** Minimal functional motion.
- Use 150ms ease transitions for hover feedback and honor `prefers-reduced-motion`.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-11 | Industrial editorial system | Makes strict technical behavior feel clear and memorable without framework or visual clutter. |
