import { describe, expect, it } from "vitest";
import { utcIsoToZonedParts, zonedWallTimeToUtcIso } from "../time";

describe("time zone conversion", () => {
  it("stores a Sofia wall time as UTC and displays it in Berlin", () => {
    const utc = zonedWallTimeToUtcIso("2026-06-09", "12:00", "Europe/Sofia");

    expect(utc).toBe("2026-06-09T09:00:00.000Z");
    expect(utcIsoToZonedParts(utc, "Europe/Berlin")).toEqual({
      date: "2026-06-09",
      time: "11:00",
    });
  });
});
