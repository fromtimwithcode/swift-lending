import { describe, expect, test } from "vitest";
import { getMaturityDate } from "./dates";

describe("loan maturity dates", () => {
  test("uses month end when the target month is shorter", () => {
    expect(getMaturityDate("08/31/2026", 6)).toBe("02/28/2027");
  });

  test("preserves leap day when available", () => {
    expect(getMaturityDate("01/31/2028", 1)).toBe("02/29/2028");
  });

  test("rejects invalid dates and terms", () => {
    expect(getMaturityDate("02/30/2026", 6)).toBe("");
    expect(getMaturityDate("02/28/2026", 0)).toBe("");
  });
});
