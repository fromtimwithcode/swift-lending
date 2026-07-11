import { ConvexError, v } from "convex/values";

export const accountTypeValidator = v.union(
  v.literal("checking"),
  v.literal("savings")
);

export function requiredText(
  value: string,
  label: string,
  maxLength = 120
): string {
  const normalized = value.trim();
  if (!normalized) throw new ConvexError(`${label} is required`);
  if (normalized.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeEin(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length !== 9) {
    throw new ConvexError("EIN must contain exactly 9 digits");
  }
  return digits;
}

export function normalizeRoutingNumber(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length !== 9) {
    throw new ConvexError("Routing number must contain exactly 9 digits");
  }

  const weights = [3, 7, 1];
  const checksum = digits
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * weights[index % 3], 0);
  if (checksum % 10 !== 0) {
    throw new ConvexError("Enter a valid routing number");
  }
  return digits;
}

export function normalizeAccountNumber(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length < 4 || digits.length > 17) {
    throw new ConvexError("Account number must contain 4 to 17 digits");
  }
  return digits;
}
