import { describe, expect, test } from "vitest";
import { createPayoffStatementPdf } from "./payoff-statement-pdf";

describe("payoff statement PDF", () => {
  test("creates a single-page PDF with the dated payoff values", async () => {
    const doc = await createPayoffStatementPdf({
      issuedDate: "08/11/2026",
      goodThroughDate: "08/14/2026",
      borrowerName: "Savior Assets LLC",
      propertyAddress: "524 E. Oak St., Juneau, WI 53039",
      principal: 155_000,
      grossAccruedInterest: 5_829.02,
      interestCredits: 3_000,
      unpaidInterest: 2_829.02,
      totalPayoff: 157_829.02,
      perDiemInterest: 52.42,
    });

    expect(doc.getNumberOfPages()).toBe(1);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(2_000);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF-");
  });
});
