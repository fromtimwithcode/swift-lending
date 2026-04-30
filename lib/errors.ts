import { ConvexError } from "convex/values";

/** Extract a human-readable message from a caught error (ConvexError or plain Error). */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ConvexError) return err.data as string;
  if (err instanceof Error) return err.message;
  return fallback;
}
