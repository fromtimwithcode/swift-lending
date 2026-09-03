import { describe, expect, test } from "vitest";
import { formatUsDate, getBusinessDate } from "./dates";

describe("business dates", () => {
  test("uses the Wisconsin calendar date before the UTC day changes", () => {
    expect(
      formatUsDate(getBusinessDate(new Date("2026-09-05T00:30:00.000Z")))
    ).toBe("09/04/2026");
  });

  test("uses the Wisconsin calendar date across daylight saving time", () => {
    expect(
      formatUsDate(getBusinessDate(new Date("2026-01-15T05:30:00.000Z")))
    ).toBe("01/14/2026");
    expect(
      formatUsDate(getBusinessDate(new Date("2026-07-15T04:30:00.000Z")))
    ).toBe("07/14/2026");
  });
});
