import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("surfaces a safe reconciliation action for payoff errors", () => {
    const error = new ConvexError(
      "Funding history needs reconciliation before charges or payoff can be calculated. Contact an administrator."
    );

    expect(getErrorMessage(error, "Unable to calculate the payoff")).toBe(
      "Funding history needs reconciliation before this payoff can be calculated."
    );
  });

  it("surfaces structured public messages without exposing error metadata", () => {
    const error = new ConvexError({
      code: "GOOD_THROUGH_DATE_TOO_LATE",
      publicMessage: "Good-through date cannot be after 12/31/2026.",
      internalDetail: "hidden",
    });

    expect(getErrorMessage(error, "Unable to calculate the payoff")).toBe(
      "Good-through date cannot be after 12/31/2026."
    );
  });
});
