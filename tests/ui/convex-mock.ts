// Test-only adapter: actual pages/components, no network or live Convex deployment.
import { useSyncExternalStore } from "react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import {
  getLoanStatusChangeError,
  getStatusNoteError,
  type LoanProgressStatus,
  type LoanStatus,
} from "../../convex/lib/loanStatus";
import { getDeleteReasonError } from "../../convex/lib/paymentReminders";

const firstLoan = {
  _id: "loan-1",
  _creationTime: 1789603200000,
  borrowerId: "borrower-1",
  borrowerName: "Jordan Morgan",
  entityName: "Morgan Property Group LLC",
  propertyAddress: "1428 North Prospect Avenue, Milwaukee, WI 53202",
  purchasePrice: 180000,
  loanAmount: 220000,
  interestRate: 12,
  monthlyPayment: 2200,
  pointsEarned: 6600,
  terms: "12 months",
  status: "under_review" as LoanStatus,
  statusNote: undefined as string | undefined,
  progressStatus: undefined as LoanProgressStatus | undefined,
  returnedDate: undefined as string | undefined,
  drawFundsTotal: undefined as number | undefined,
  drawFundsUsed: undefined as number | undefined,
};
let loans = [
  firstLoan,
  {
    ...firstLoan,
    _id: "loan-2",
    propertyAddress: "4820 West North Avenue, Milwaukee, WI 53208",
    status: "closed" as LoanStatus,
  },
];
let draws: Record<string, unknown>[] = [];
type MockCharge = {
  _id: string;
  type: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: "scheduled" | "paid" | "waived";
  reason?: string;
};
let charges: MockCharge[] = [];
let payments: Record<string, unknown>[] = [];
const reminderBase = {
  loanId: "loan-1",
  borrowerName: "Matt Rekowski",
  propertyAddress: "1412 N 3rd Street, Wausau, WI, USA",
  amount: 42.83,
  status: "past_due" as const,
};
let reminders = [
  { ...reminderBase, dueDate: "04/01/2026", daysUntilDue: -187, source: "scheduled_charge", type: "monthly_interest", chargeId: "charge-april" },
  { ...reminderBase, dueDate: "05/01/2026", daysUntilDue: -157, source: "scheduled_charge", type: "monthly_interest+draw_proration" },
  { ...reminderBase, dueDate: "06/01/2026", daysUntilDue: -126, source: "monthly_payment", type: "monthly_payment" },
];
let version = 0;
const subscribers = new Set<() => void>();
function notify() {
  version++;
  subscribers.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};
const controls = {
  delay: 0,
  error: "",
  calls: [] as { name: string; args: Record<string, unknown> }[],
  setLoan: (patch: Partial<typeof firstLoan>) => {
    loans = [{ ...loans[0], ...patch }, loans[1]];
    notify();
  },
  setDraws: (next: Record<string, unknown>[]) => {
    draws = next;
    notify();
  },
  setCharges: (next: MockCharge[], nextPayments: Record<string, unknown>[] = []) => {
    charges = next;
    payments = nextPayments;
    notify();
  },
};
declare global {
  interface Window {
    statusTest: typeof controls;
  }
}
window.statusTest = controls;
const empty: unknown[] = [];
export function useQuery(
  reference: FunctionReference<"query">,
  args?: unknown,
) {
  useSyncExternalStore(subscribe, () => version);
  if (args === "skip") return undefined;
  switch (getFunctionName(reference)) {
    case "admin:getLoan":
    case "borrower:getMyLoan":
      return loans[0];
    case "activityLog:getRecentActivity": return [{
      _id: "activity-1", _creationTime: 1789603200000, userName: "Reviewer", action: "loan.status", entityType: "loan", entityId: "loan-1",
      details: 'Changed status from "Under Review" to "Additional Info Needed" for 1428 North Prospect Avenue\nExplanation: Please upload an updated insurance policy.\nInclude the property address and coverage dates.',
    }];
    case "admin:getLoans":
      return loans;
    case "admin:getOverviewStats":
      return {
        totalLoans: 0, activePipeline: 1, closedLoans: 1, returnedLoans: 0, capitalCurrentlyOut: 0,
        totalDrawRemaining: 0, closedLoanRevenue: 0, monthlyCashFlow: 0, cashFlowInterestRate: 0,
        totalPrincipalOut: 0, pipelineValue: 0, statusCounts: {}, monthlyVolume: {}, recentLoans: loans,
      };
    case "loanPayments:getAdminPaymentReminders":
      return {
        reminders,
        pastDueCount: reminders.length,
        dueSoonCount: 0,
        totalAmountDue: reminders.reduce((sum, reminder) => sum + reminder.amount, 0),
        windowDays: 14,
      };
    case "loanPayments:getAllPaymentsSummary":
    case "admin:getLoanPeriodKpis":
      return undefined;
    case "draws:getDrawRequestsForLoan":
    case "borrower:getDrawRequestsForLoan":
      return draws;
    case "admin:getClosingStatementUrl":
      return null;
    case "loanCharges:getChargesForLoan":
      return charges.filter((charge) => charge.status !== "waived");
    case "loanPayments:getPaymentsForLoan":
      return payments;
    case "loanCharges:getDeletedPaymentItemsForLoan":
      return charges
        .filter((charge) => charge.status === "waived")
        .map((charge) => ({
          kind: "charge",
          id: charge._id,
          type: charge.type,
          amount: charge.amount,
          dueDate: charge.dueDate,
          reason: charge.reason,
          deletedByName: "Reviewer",
          deletedAt: 1789603200000,
        }));
    case "borrower:isRepeatEntity":
      return false;
    case "payoffs:getPayoffReadiness":
      return undefined;
    default:
      return empty;
  }
}
export function useMutation(reference: FunctionReference<"mutation">) {
  return async (args: Record<string, unknown>) => {
    const name = getFunctionName(reference);
    controls.calls.push({ name, args });
    if (controls.delay)
      await new Promise((resolve) => setTimeout(resolve, controls.delay));
    if (controls.error) throw new Error(controls.error);
    if (name === "draws:createManualDrawRequest" || name === "borrower:submitDrawRequest")
      return "draw-new";
    if (name === "loanCharges:deletePaymentReminder" || name === "loanCharges:removeCharge") {
      const error = getDeleteReasonError(args.reason as string);
      if (error) throw new ConvexError({ publicMessage: error });
    }
    if (name === "loanCharges:deletePaymentReminder") {
      reminders = reminders.filter((reminder) => reminder.dueDate !== args.dueDate);
      notify();
      return { deleted: true };
    }
    if (name === "loanCharges:removeCharge" || name === "loanCharges:restoreCharge") {
      const waive = name === "loanCharges:removeCharge";
      charges = charges.map((charge) =>
        charge._id === args.id
          ? { ...charge, status: waive ? "waived" : "scheduled", reason: waive ? (args.reason as string) : undefined }
          : charge,
      );
      notify();
      return waive ? args.id : { restored: true };
    }
    const status = args.status as LoanStatus;
    const update = (id: string, expectedStatus?: LoanStatus) => {
      const loan = loans.find((item) => item._id === id)!;
      const error =
        getLoanStatusChangeError(loan, status, expectedStatus) ??
        (loan.status !== status
          ? getStatusNoteError(status, args.note as string)
          : null);
      if (error) return { loanId: id, success: false, error };
      const changed = loan.status !== status;
      if (changed)
        loans = loans.map((item) =>
          item._id === id
            ? {
                ...item,
                status,
                statusNote: (args.note as string)?.trim() || undefined,
              }
            : item,
        );
      return { loanId: id, success: true, changed };
    };
    if (name === "admin:updateLoanStatus") {
      const result = update(
        args.id as string,
        args.expectedStatus as LoanStatus,
      );
      if (!result.success)
        throw new ConvexError({ publicMessage: result.error! });
      notify();
      return args.id;
    }
    if (name === "admin:bulkUpdateLoanStatus") {
      const expected = args.expectedStatuses as {
        loanId: string;
        status: LoanStatus;
      }[];
      const results = (args.loanIds as string[]).map((id) =>
        update(id, expected.find((entry) => entry.loanId === id)?.status),
      );
      notify();
      return results;
    }
    throw new Error(`Unmocked mutation: ${name}`);
  };
}
export const useAction = () => async () => {
  throw new Error("Actions are disabled in UI tests");
};
const client = {
  watchQuery: () => ({
    localQueryResult: () => undefined,
    onUpdate: () => () => {},
  }),
};
export const useConvex = () => client;
