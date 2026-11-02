import { v } from "convex/values";

export const MAX_TITLE_COMPANIES = 200;
export const MAX_TITLE_COMPANY_CONTACTS = 25;

export const TITLE_COMPANY_LIMITS = {
  name: 120,
  phone: 40,
  email: 254,
  address: 240,
  notes: 2000,
  contactRole: 120,
  bankName: 120,
  accountName: 120,
} as const;

export const wireFieldValidator = v.union(
  v.literal("routing_number"),
  v.literal("account_number")
);
export type WireField = typeof wireFieldValidator.type;

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTitleCompanyName(name: string): string {
  return collapseWhitespace(name).toLowerCase();
}
