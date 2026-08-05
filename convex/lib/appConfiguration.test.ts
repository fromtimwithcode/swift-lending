import { describe, expect, test } from "vitest";
import {
  DEFAULT_APP_CONFIGURATION,
  appConfigurationsEqual,
  normalizeAppConfiguration,
  type AppConfiguration,
} from "./appConfiguration";

function configuration(overrides: Partial<AppConfiguration["loanDefaults"]> = {}) {
  return {
    loanDefaults: { ...DEFAULT_APP_CONFIGURATION.loanDefaults, ...overrides },
    operations: { ...DEFAULT_APP_CONFIGURATION.operations },
    comparables: { ...DEFAULT_APP_CONFIGURATION.comparables },
  };
}

describe("app configuration policy", () => {
  test("normalizes governed decimal values without mutating the input", () => {
    const input = configuration({
      annualInterestRate: 13.456,
      originationPointsPercentage: 3.125,
    });

    const normalized = normalizeAppConfiguration(input);

    expect(normalized.loanDefaults.annualInterestRate).toBe(13.46);
    expect(normalized.loanDefaults.originationPointsPercentage).toBe(3.13);
    expect(input.loanDefaults.annualInterestRate).toBe(13.456);
  });

  test.each([
    ["payment due day", configuration({ paymentDueDay: 0 })],
    ["fractional loan term", configuration({ loanTermMonths: 6.5 })],
    ["non-finite rate", configuration({ annualInterestRate: Number.NaN })],
  ])("rejects invalid %s", (_label, input) => {
    expect(() => normalizeAppConfiguration(input)).toThrow();
  });

  test("compares the complete configuration", () => {
    const first = configuration();
    const second = configuration();
    expect(appConfigurationsEqual(first, second)).toBe(true);

    second.operations.paymentReminderWindowDays += 1;
    expect(appConfigurationsEqual(first, second)).toBe(false);
  });
});
