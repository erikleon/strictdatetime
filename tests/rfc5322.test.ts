import { describe, expect, it } from "vitest";
import { parseRfc5322DateTime, toInstantString } from "../src/index.js";
import { expectDateTimeError } from "./helpers.js";

const iso = (input: string, options?: Parameters<typeof parseRfc5322DateTime>[1]) =>
  toInstantString(parseRfc5322DateTime(input, options));

describe("parseRfc5322DateTime", () => {
  it("parses the usual email Date header forms", () => {
    expect(iso("Mon, 16 Feb 2026 10:00:00 -0500")).toBe("2026-02-16T15:00:00.000Z");
    expect(iso("16 Feb 2026 10:00:00 -0500")).toBe("2026-02-16T15:00:00.000Z");
    expect(iso("Mon,16 Feb 2026 10:00 +0530")).toBe("2026-02-16T04:30:00.000Z");
    expect(iso("1 Mar 2026 00:00:59 +0000")).toBe("2026-03-01T00:00:59.000Z");
    expect(iso("mon, 16 FEB 2026 10:00:00 +0000")).toBe("2026-02-16T10:00:00.000Z");
  });

  it("reads -0000 as the same instant as +0000", () => {
    expect(iso("16 Feb 2026 10:00:00 -0000")).toBe("2026-02-16T10:00:00.000Z");
  });

  it("unfolds folded lines, collapses whitespace, and drops trailing comments", () => {
    expect(iso("  Mon, 16 Feb\r\n 2026\t10:00:00   -0500  ")).toBe("2026-02-16T15:00:00.000Z");
    expect(iso("Mon, 16 Feb 2026 10:00:00 +0000 (UTC)")).toBe("2026-02-16T10:00:00.000Z");
    expect(iso("Mon, 16 Feb 2026 10:00:00 +0000 (a (nested) \\) comment) (two)")).toBe(
      "2026-02-16T10:00:00.000Z",
    );
  });

  it("rejects malformed comments and comments before the zone", () => {
    for (const input of [
      "Mon, 16 Feb 2026 10:00:00 +0000 (UTC",
      "Mon, 16 Feb 2026 10:00:00 +0000 UTC)",
      "Mon, 16 Feb 2026 10:00:00 +0000 (UTC))",
      "Mon, 16 Feb 2026 10:00:00 +0000 (UTC) x",
      "Mon, 16 Feb 2026 10:00:00 +0000 x (UTC)",
      "Mon, 16 Feb 2026 (noon) 10:00:00 +0000",
      "Mon, 16 Feb 2026 10:00:00 +0000 \\(UTC)",
    ]) {
      expectDateTimeError(() => parseRfc5322DateTime(input), "INVALID_RFC5322");
    }
  });

  it("accepts obsolete zone names only when asked", () => {
    expectDateTimeError(
      () => parseRfc5322DateTime("Sun, 06 Nov 1994 08:49:37 GMT"),
      "INVALID_RFC5322",
    );
    const options = { allowObsoleteZones: true };
    expect(iso("Sun, 06 Nov 1994 08:49:37 GMT", options)).toBe("1994-11-06T08:49:37.000Z");
    expect(iso("Sun, 06 Nov 1994 08:49:37 ut", options)).toBe("1994-11-06T08:49:37.000Z");
    expect(iso("Sun, 06 Nov 1994 08:49:37 EST", options)).toBe("1994-11-06T13:49:37.000Z");
    expect(iso("Sun, 06 Nov 1994 08:49:37 PDT", options)).toBe("1994-11-06T15:49:37.000Z");
    expect(iso("Sun, 06 Nov 1994 08:49:37 +0100", { allowObsoleteZones: false })).toBe(
      "1994-11-06T07:49:37.000Z",
    );
    for (const zone of ["Z", "A", "CET", "UTC"]) {
      expectDateTimeError(
        () => parseRfc5322DateTime(`Sun, 06 Nov 1994 08:49:37 ${zone}`, options),
        "INVALID_RFC5322",
      );
    }
  });

  it("rejects obsolete and malformed forms", () => {
    for (const input of [
      "",
      "Mon, 16 Feb 26 10:00:00 -0500",
      "Mon, 16 Feb 02026 10:00:00 -0500",
      "Mon, 16 Feb 2026 10:00:00.5 -0500",
      "Mon, 16 Feb 2026 10 : 00 : 00 -0500",
      "Mon, 16 Feb 2026 10:00:00 -05:00",
      "Mon, 16 Feb 2026 10:00:00 -500",
      "Mon, 16 Feb 2026 10:00:00",
      "Mon , 16 Feb 2026 10:00:00 -0500",
      "Monday, 16 Feb 2026 10:00:00 -0500",
      "Mon, 16 February 2026 10:00:00 -0500",
      "Mon, 16 Fex 2026 10:00:00 -0500",
      "Mox, 16 Feb 2026 10:00:00 -0500",
      "2026-02-16T10:00:00Z",
      "Mon, 16 Feb 2026 10:00:00 +2400",
      "Mon, 16 Feb 2026 10:00:00 +0060",
      "Mon, 16 Feb 2026 10:00:00 -0500\r\n",
      "Mon, 16 Feb 2026\n 10:00:00 -0500",
      "Mon, 16 Feb 2026 10:00:00\u0000 -0500",
    ]) {
      expectDateTimeError(() => parseRfc5322DateTime(input), "INVALID_RFC5322");
    }
  });

  it("checks the day of the week against the date", () => {
    expectDateTimeError(
      () => parseRfc5322DateTime("Tue, 16 Feb 2026 10:00:00 -0500"),
      "INVALID_RFC5322",
    );
    // The day name belongs to the local date, not the UTC one.
    expect(iso("Mon, 16 Feb 2026 23:30:00 -0500")).toBe("2026-02-17T04:30:00.000Z");
  });

  it("rejects impossible dates and times", () => {
    for (const input of [
      "30 Feb 2026 10:00:00 +0000",
      "0 Feb 2026 10:00:00 +0000",
      "16 Feb 2026 24:00:00 +0000",
      "16 Feb 2026 10:60:00 +0000",
      "31 Dec 2016 23:59:60 +0000",
      "16 Feb 1899 10:00:00 +0000",
    ]) {
      expectDateTimeError(() => parseRfc5322DateTime(input), "OUT_OF_RANGE");
    }
    expect(iso("1 Jan 1900 00:00:00 +0000")).toBe("1900-01-01T00:00:00.000Z");
  });

  it("rejects wrong argument types", () => {
    expectDateTimeError(() => parseRfc5322DateTime(1 as never), "INVALID_TYPE");
    expectDateTimeError(
      () =>
        parseRfc5322DateTime("16 Feb 2026 10:00:00 +0000", { allowObsoleteZones: "yes" as never }),
      "INVALID_OPTION",
    );
  });
});
