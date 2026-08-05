import type { Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { parseUsDate, validateUsDate } from "./dates";

type LoanDrawDates = Pick<Doc<"loans">, "closeDate" | "maturityDate">;

export function getDrawWireDateError(loan: LoanDrawDates, wireDate: string) {
  const wire = parseUsDate(wireDate);
  if (!wire) return "Wire date must be a valid date in MM/DD/YYYY format";
  if (!loan.closeDate) return "Loan must have a closing date before a draw can be approved";

  const close = parseUsDate(loan.closeDate);
  if (!close) return "Loan has an invalid closing date";
  if (wire < close) return "Wire date cannot be before the loan closing date";

  if (loan.maturityDate) {
    const maturity = parseUsDate(loan.maturityDate);
    if (!maturity) return "Loan has an invalid maturity date";
    if (wire > maturity) return "Wire date cannot be after the loan maturity date";
  }

  return null;
}

export function validateDrawWireDateForLoan(loan: LoanDrawDates, wireDate: string) {
  const wire = validateUsDate(wireDate, "Wire date");
  const error = getDrawWireDateError(loan, wireDate);
  if (error) throw new ConvexError(error);
  return wire;
}
