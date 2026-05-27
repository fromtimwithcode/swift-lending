import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync monthly interest charges",
  { hours: 24 },
  internal.loanCharges.syncInterestChargesForActiveLoans,
  {}
);

crons.interval(
  "send borrower payment reminders",
  { hours: 24 },
  internal.loanPayments.sendBorrowerPaymentReminderNotifications,
  {}
);

export default crons;
