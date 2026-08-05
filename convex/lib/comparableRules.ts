export const MAX_COMPARABLE_RESULTS = 8;

export const COMPARABLE_SCORE_RULES = {
  sameState: 18,
  sameCity: 22,
  purchasePrice: 28,
  afterRepairValue: 12,
  rehabBudget: 8,
  status: {
    closed: 12,
    funded: 10,
    sentToTitle: 8,
  },
  recencyMax: 12,
  recencyPointsLostPerMonth: 0.5,
  similarityPenaltyMultiplier: 3,
  maxScore: 100,
} as const;
