import { ConvexError } from "convex/values";

export function parseUsDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function validateUsDate(value: string, label: string, options?: { allowFuture?: boolean }) {
  const date = parseUsDate(value);
  if (!date) {
    throw new ConvexError(`${label} must be a valid date in MM/DD/YYYY format`);
  }

  if (!options?.allowFuture && date > new Date()) {
    throw new ConvexError(`${label} cannot be in the future`);
  }

  return date;
}
