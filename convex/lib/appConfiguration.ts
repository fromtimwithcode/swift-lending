import { ConvexError, v } from "convex/values";
import {
  DEFAULT_INTEREST_RATE,
  DEFAULT_PAYMENT_DUE_DAY,
  DEFAULT_POINTS_PERCENTAGE,
} from "./constants";
import {
  DEFAULT_LOAN_TERM_MONTHS,
  INTEREST_CHARGE_WINDOW_DAYS,
  PAYMENT_REMINDER_WINDOW_DAYS,
} from "./financialRules";
import {
  COMPARABLE_SCORE_RULES,
  MAX_COMPARABLE_RESULTS,
} from "./comparableRules";

export const APP_CONFIGURATION_SCOPE = "global" as const;

export interface AppConfiguration {
  loanDefaults: {
    annualInterestRate: number;
    originationPointsPercentage: number;
    paymentDueDay: number;
    loanTermMonths: number;
  };
  operations: {
    interestChargeWindowDays: number;
    paymentReminderWindowDays: number;
  };
  comparables: {
    maxResults: number;
    sameState: number;
    sameCity: number;
    purchasePrice: number;
    afterRepairValue: number;
    rehabBudget: number;
    statusClosed: number;
    statusFunded: number;
    statusSentToTitle: number;
    recencyMax: number;
    recencyPointsLostPerMonth: number;
    similarityPenaltyMultiplier: number;
    maxScore: number;
  };
}

export const appConfigurationValidator = v.object({
  loanDefaults: v.object({
    annualInterestRate: v.number(),
    originationPointsPercentage: v.number(),
    paymentDueDay: v.number(),
    loanTermMonths: v.number(),
  }),
  operations: v.object({
    interestChargeWindowDays: v.number(),
    paymentReminderWindowDays: v.number(),
  }),
  comparables: v.object({
    maxResults: v.number(),
    sameState: v.number(),
    sameCity: v.number(),
    purchasePrice: v.number(),
    afterRepairValue: v.number(),
    rehabBudget: v.number(),
    statusClosed: v.number(),
    statusFunded: v.number(),
    statusSentToTitle: v.number(),
    recencyMax: v.number(),
    recencyPointsLostPerMonth: v.number(),
    similarityPenaltyMultiplier: v.number(),
    maxScore: v.number(),
  }),
});

export const DEFAULT_APP_CONFIGURATION: AppConfiguration = {
  loanDefaults: {
    annualInterestRate: DEFAULT_INTEREST_RATE,
    originationPointsPercentage: DEFAULT_POINTS_PERCENTAGE,
    paymentDueDay: DEFAULT_PAYMENT_DUE_DAY,
    loanTermMonths: DEFAULT_LOAN_TERM_MONTHS,
  },
  operations: {
    interestChargeWindowDays: INTEREST_CHARGE_WINDOW_DAYS,
    paymentReminderWindowDays: PAYMENT_REMINDER_WINDOW_DAYS,
  },
  comparables: {
    maxResults: MAX_COMPARABLE_RESULTS,
    sameState: COMPARABLE_SCORE_RULES.sameState,
    sameCity: COMPARABLE_SCORE_RULES.sameCity,
    purchasePrice: COMPARABLE_SCORE_RULES.purchasePrice,
    afterRepairValue: COMPARABLE_SCORE_RULES.afterRepairValue,
    rehabBudget: COMPARABLE_SCORE_RULES.rehabBudget,
    statusClosed: COMPARABLE_SCORE_RULES.status.closed,
    statusFunded: COMPARABLE_SCORE_RULES.status.funded,
    statusSentToTitle: COMPARABLE_SCORE_RULES.status.sentToTitle,
    recencyMax: COMPARABLE_SCORE_RULES.recencyMax,
    recencyPointsLostPerMonth:
      COMPARABLE_SCORE_RULES.recencyPointsLostPerMonth,
    similarityPenaltyMultiplier:
      COMPARABLE_SCORE_RULES.similarityPenaltyMultiplier,
    maxScore: COMPARABLE_SCORE_RULES.maxScore,
  },
};

function decimal(
  value: number,
  label: string,
  min: number,
  max: number,
  precision = 2
) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ConvexError(`${label} must be between ${min} and ${max}`);
  }
  const scale = 10 ** precision;
  const rounded = Math.round(value * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function integer(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConvexError(`${label} must be a whole number between ${min} and ${max}`);
  }
  return value;
}

export function normalizeAppConfiguration(
  input: AppConfiguration
): AppConfiguration {
  return {
    loanDefaults: {
      annualInterestRate: decimal(
        input.loanDefaults.annualInterestRate,
        "Default annual interest rate",
        0,
        100
      ),
      originationPointsPercentage: decimal(
        input.loanDefaults.originationPointsPercentage,
        "Origination points",
        0,
        100
      ),
      paymentDueDay: integer(
        input.loanDefaults.paymentDueDay,
        "Default payment due day",
        1,
        31
      ),
      loanTermMonths: integer(
        input.loanDefaults.loanTermMonths,
        "Standard loan term",
        1,
        120
      ),
    },
    operations: {
      interestChargeWindowDays: integer(
        input.operations.interestChargeWindowDays,
        "Interest charge preparation window",
        0,
        90
      ),
      paymentReminderWindowDays: integer(
        input.operations.paymentReminderWindowDays,
        "Payment reminder window",
        0,
        90
      ),
    },
    comparables: {
      maxResults: integer(
        input.comparables.maxResults,
        "Maximum comparable results",
        1,
        25
      ),
      sameState: decimal(input.comparables.sameState, "Same-state weight", 0, 100),
      sameCity: decimal(input.comparables.sameCity, "Same-city weight", 0, 100),
      purchasePrice: decimal(
        input.comparables.purchasePrice,
        "Purchase-price weight",
        0,
        100
      ),
      afterRepairValue: decimal(
        input.comparables.afterRepairValue,
        "After-repair-value weight",
        0,
        100
      ),
      rehabBudget: decimal(
        input.comparables.rehabBudget,
        "Rehab-budget weight",
        0,
        100
      ),
      statusClosed: decimal(
        input.comparables.statusClosed,
        "Closed-status weight",
        0,
        100
      ),
      statusFunded: decimal(
        input.comparables.statusFunded,
        "Funded-status weight",
        0,
        100
      ),
      statusSentToTitle: decimal(
        input.comparables.statusSentToTitle,
        "Sent-to-title status weight",
        0,
        100
      ),
      recencyMax: decimal(
        input.comparables.recencyMax,
        "Maximum recency weight",
        0,
        100
      ),
      recencyPointsLostPerMonth: decimal(
        input.comparables.recencyPointsLostPerMonth,
        "Monthly recency reduction",
        0,
        25
      ),
      similarityPenaltyMultiplier: decimal(
        input.comparables.similarityPenaltyMultiplier,
        "Similarity penalty multiplier",
        0,
        25
      ),
      maxScore: integer(
        input.comparables.maxScore,
        "Maximum comparable score",
        1,
        1000
      ),
    },
  };
}

export function appConfigurationsEqual(
  left: AppConfiguration,
  right: AppConfiguration
) {
  return JSON.stringify(left) === JSON.stringify(right);
}
