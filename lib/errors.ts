import { ConvexError } from "convex/values";

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
const MAX_ERROR_MESSAGE_LENGTH = 220;

type ErrorWithData = {
  data?: unknown;
  message?: unknown;
};

function cleanMessage(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function mapKnownMessage(message: string) {
  const clean = cleanMessage(message);
  const lower = clean.toLowerCase();

  if (!clean) return null;
  if (
    clean === "[object Object]" ||
    lower.includes("[convex") ||
    lower.includes("convexerror") ||
    lower.includes("api key") ||
    lower.includes("environment") ||
    lower.includes("not configured") ||
    lower.includes("request id") ||
    lower.includes("secret") ||
    lower.includes("stack trace") ||
    lower.includes("token") ||
    lower.includes("uncaught")
  ) {
    return null;
  }
  if (lower.includes("not authenticated")) return "Please sign in to continue.";
  if (lower.includes("account is deactivated")) return "Your account is deactivated. Contact an administrator.";
  if (
    lower.includes("not authorized") ||
    lower.includes("not your") ||
    lower.startsWith("requires ") ||
    lower.includes("requires one of")
  ) {
    return "You do not have permission to do that.";
  }
  if (lower.endsWith("not found") || lower === "not found") {
    return "We could not find that record.";
  }

  return clean;
}

function messageFromConvexData(data: unknown) {
  if (typeof data === "string") return mapKnownMessage(data);
  if (!data || typeof data !== "object") return null;

  const maybeMessage = (data as { message?: unknown; publicMessage?: unknown }).publicMessage ??
    (data as { message?: unknown }).message;

  return typeof maybeMessage === "string" ? mapKnownMessage(maybeMessage) : null;
}

function messageFromWrappedConvexError(message: string) {
  const convexErrorLine = message
    .split("\n")
    .find((line) => /ConvexError:/i.test(line));
  const match = convexErrorLine?.match(/ConvexError:\s*(.+)$/i);

  return match?.[1] ? mapKnownMessage(match[1]) : null;
}

/**
 * Extract safe, user-facing copy from expected application errors.
 * Raw framework, transport, and unexpected Error messages are intentionally hidden.
 */
export function getErrorMessage(err: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const safeFallback = cleanMessage(fallback || DEFAULT_ERROR_MESSAGE);

  if (err instanceof ConvexError) {
    return messageFromConvexData(err.data) ?? safeFallback;
  }

  if (err && typeof err === "object") {
    const errorLike = err as ErrorWithData;
    const dataMessage = messageFromConvexData(errorLike.data);
    if (dataMessage) return dataMessage;

    if (typeof errorLike.message === "string") {
      const convexMessage = messageFromWrappedConvexError(errorLike.message);
      if (convexMessage) return convexMessage;
    }
  }

  if (typeof err === "string") {
    const convexMessage = messageFromWrappedConvexError(err);
    if (convexMessage) return convexMessage;
  }

  return safeFallback;
}
