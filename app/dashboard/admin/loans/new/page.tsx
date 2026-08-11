"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { AddressInput } from "@/components/dashboard/address-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { calculatePoints } from "@/lib/loan-calc";
import { calculateMonthlyInterest, getCurrentPrincipalOut } from "@/convex/lib/loanCalculations";
import { DEFAULT_INTEREST_RATE, DEFAULT_POINTS_PERCENTAGE, DEFAULT_PAYMENT_DUE_DAY, PAYMENT_TYPE_LABELS, REHAB_CATEGORIES } from "@/convex/lib/constants";
import { DEFAULT_LOAN_TERM_MONTHS } from "@/convex/lib/financialRules";
import { formatCurrency } from "@/lib/format";
import { getMaturityDate } from "@/lib/dates";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { ContextTooltip } from "@/components/dashboard/context-tooltip";
import { FINANCIAL_CONTEXT } from "@/lib/financial-context";
import {
  createEmptyLoanPropertyForm,
  LoanPropertyFields,
  parseLoanPropertyForm,
} from "@/components/dashboard/loan-property-fields";

type RehabCategory = (typeof REHAB_CATEGORIES)[number]["value"];
type RehabItem = {
  id: string;
  category: RehabCategory;
  itemName: string;
  allocatedAmount: string;
};

type TitleContactOption = {
  titleCompany: string;
  titleCompanyContact?: string;
  titleCompanyContactEmail?: string;
  titleCompanyContactPhone?: string;
};

export default function NewLoanPage() {
  const createLoan = useMutation(api.admin.createLoan);
  const borrowers = useQuery(api.users.getAllBorrowers);
  const loanDefaults = useQuery(api.settings.getLoanDefaults);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [interestRateEdited, setInterestRateEdited] = useState(false);
  const [maturityDateEdited, setMaturityDateEdited] = useState(false);
  const loanDefaultsLoading = loanDefaults === undefined;

  const [form, setForm] = useState({
    borrowerId: "",
    borrowerName: "",
    entityName: "",
    propertyAddress: "",
    purchasePrice: "",
    loanAmount: "",
    rehabBudgetTotal: "",
    afterRepairValue: "",
    closeDate: "",
    maturityDate: "",
    terms: "",
    interestRate: String(DEFAULT_INTEREST_RATE),
    monthlyPayment: "",
    paymentDueDay: String(DEFAULT_PAYMENT_DUE_DAY),
    pointsEarned: "",
    monthlyInterestEarned: "",
    paymentType: "monthly" as "balloon" | "monthly",
    status: "submitted" as const,
    titleCompany: "",
    titleCompanyContact: "",
    titleCompanyContactEmail: "",
    titleCompanyContactPhone: "",
    drawFundsTotal: "",
    drawFundsUsed: "",
    notes: "",
  });
  const [propertyDetails, setPropertyDetails] = useState(createEmptyLoanPropertyForm);

  const [rehabItems, setRehabItems] = useState<RehabItem[]>([]);
  const selectedBorrower = borrowers?.find((b) => b._id === form.borrowerId);
  const titleContacts = (selectedBorrower?.titleContacts ?? []) as TitleContactOption[];

  const rehabItemsTotal = rehabItems.reduce(
    (sum, item) => sum + (Number(item.allocatedAmount) || 0),
    0
  );
  const defaultLoanAmount = (Number(form.purchasePrice) || 0) + (rehabItemsTotal || Number(form.rehabBudgetTotal) || 0);
  const [loanAmountEdited, setLoanAmountEdited] = useState(false);
  const defaultPointsPercentage =
    loanDefaults?.defaultPointsPercentage ?? DEFAULT_POINTS_PERCENTAGE;
  const defaultLoanTermMonths =
    loanDefaults?.defaultLoanTermMonths ?? DEFAULT_LOAN_TERM_MONTHS;

  // Default loan amount to purchase + rehab, but let admins override it for larger down payments.
  useEffect(() => {
    const loanAmount = loanAmountEdited ? Number(form.loanAmount) || 0 : defaultLoanAmount;
    const rate = Number(form.interestRate) || 0;
    const principalOut = getCurrentPrincipalOut({
      loanAmount,
      drawFundsTotal: Number(form.drawFundsTotal) || undefined,
      drawFundsUsed: Number(form.drawFundsUsed) || undefined,
    });
    const monthly = form.paymentType === "balloon" ? 0 : calculateMonthlyInterest(principalOut, rate);
    const points = calculatePoints(loanAmount, defaultPointsPercentage);
    const nextLoanAmount = loanAmountEdited ? form.loanAmount : defaultLoanAmount ? String(defaultLoanAmount) : "";
    const nextMonthlyPayment = monthly ? String(monthly) : "";
    const nextPointsEarned = points ? String(points) : "";

    setForm((prev) => {
      if (
        prev.loanAmount === nextLoanAmount &&
        prev.monthlyPayment === nextMonthlyPayment &&
        prev.pointsEarned === nextPointsEarned
      ) {
        return prev;
      }

      return {
        ...prev,
        loanAmount: nextLoanAmount,
        monthlyPayment: nextMonthlyPayment,
        pointsEarned: nextPointsEarned,
      };
    });
  }, [defaultLoanAmount, defaultPointsPercentage, form.loanAmount, form.interestRate, form.paymentType, form.drawFundsTotal, form.drawFundsUsed, loanAmountEdited]);

  useEffect(() => {
    if (!loanDefaults || interestRateEdited) return;

    setForm((prev) => {
      const defaultRate = String(loanDefaults.defaultInterestRate);
      const defaultDueDay = String(loanDefaults.defaultPaymentDueDay);
      const paymentDueDay =
        prev.paymentDueDay === String(DEFAULT_PAYMENT_DUE_DAY)
          ? defaultDueDay
          : prev.paymentDueDay;
      return prev.interestRate === defaultRate && prev.paymentDueDay === paymentDueDay
        ? prev
        : { ...prev, interestRate: defaultRate, paymentDueDay };
    });
  }, [loanDefaults, interestRateEdited]);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleLoanAmountChange = (value: string) => {
    setLoanAmountEdited(true);
    update("loanAmount", value);
  };

  const resetLoanAmount = () => {
    setLoanAmountEdited(false);
    setForm((prev) => ({
      ...prev,
      loanAmount: defaultLoanAmount ? String(defaultLoanAmount) : "",
    }));
  };

  const handleBorrowerSelect = (borrowerId: string) => {
    const borrower = borrowers?.find((b) => b._id === borrowerId);
    if (borrower) {
      setForm((prev) => ({
        ...prev,
        borrowerId: borrower._id,
        borrowerName: borrower.displayName,
        entityName: borrower.company ?? "",
      }));
    }
  };

  const handleCloseDateChange = (closeDate: string) => {
    setForm((prev) => {
      const previousAutoMaturity = getMaturityDate(
        prev.closeDate,
        defaultLoanTermMonths
      );
      const nextAutoMaturity = getMaturityDate(
        closeDate,
        defaultLoanTermMonths
      );
      const shouldUpdateMaturity =
        !maturityDateEdited ||
        !prev.maturityDate ||
        prev.maturityDate === previousAutoMaturity;

      return {
        ...prev,
        closeDate,
        maturityDate: shouldUpdateMaturity ? nextAutoMaturity : prev.maturityDate,
      };
    });
  };

  const handleTitleContactSelect = (value: string) => {
    if (value === "") {
      setForm((prev) => ({
        ...prev,
        titleCompany: "",
        titleCompanyContact: "",
        titleCompanyContactEmail: "",
        titleCompanyContactPhone: "",
      }));
      return;
    }

    const contact = titleContacts[Number(value)];
    if (!contact) return;

    setForm((prev) => ({
      ...prev,
      titleCompany: contact.titleCompany,
      titleCompanyContact: contact.titleCompanyContact ?? "",
      titleCompanyContactEmail: contact.titleCompanyContactEmail ?? "",
      titleCompanyContactPhone: contact.titleCompanyContactPhone ?? "",
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (loanDefaultsLoading) {
      toast.error("Loan defaults are still loading");
      return;
    }

    if (!form.borrowerId) {
      toast.error("Please select a borrower");
      return;
    }
    if (!form.borrowerName.trim()) {
      toast.error("Borrower name is required");
      return;
    }
    if (!form.entityName.trim()) {
      toast.error("Entity / LLC is required");
      return;
    }
    if (!form.propertyAddress) {
      toast.error("Property address is required");
      return;
    }
    if (!form.purchasePrice || Number(form.purchasePrice) <= 0) {
      toast.error("Valid purchase price is required");
      return;
    }
    if (Number(form.rehabBudgetTotal) < 0) {
      toast.error("Rehab budget cannot be negative");
      return;
    }
    if (!form.loanAmount || Number(form.loanAmount) <= 0) {
      toast.error("Valid total loan amount is required");
      return;
    }
    if (form.drawFundsTotal && Number(form.drawFundsTotal) > Number(form.loanAmount)) {
      toast.error("Construction holdback cannot exceed total loan amount");
      return;
    }
    if (Number(form.interestRate) < 0) {
      toast.error("Interest rate cannot be negative");
      return;
    }
    if (Number(form.monthlyPayment) < 0) {
      toast.error("Monthly payment cannot be negative");
      return;
    }
    if (Number(form.pointsEarned) < 0) {
      toast.error("Points earned cannot be negative");
      return;
    }
    if (form.paymentDueDay && (Number(form.paymentDueDay) < 1 || Number(form.paymentDueDay) > 31)) {
      toast.error("Payment due day must be between 1 and 31");
      return;
    }
    const parsedPropertyDetails = parseLoanPropertyForm(propertyDetails);
    if ("error" in parsedPropertyDetails) {
      toast.error(parsedPropertyDetails.error);
      return;
    }
    if (!form.closeDate) {
      toast.error("Close date is required");
      return;
    }
    if (!form.titleCompany.trim()) {
      toast.error("Title company is required");
      return;
    }
    if (!form.titleCompanyContact.trim()) {
      toast.error("Title contact is required");
      return;
    }
    if (!form.titleCompanyContactEmail.trim()) {
      toast.error("Title contact email is required");
      return;
    }
    if (!form.titleCompanyContactPhone.trim()) {
      toast.error("Title contact phone is required");
      return;
    }

    setSubmitting(true);
    try {
      // Build rehab budget items array from local state
      const validRehabItems = rehabItems
        .filter((i) => i.itemName.trim() && Number(i.allocatedAmount) > 0)
        .map((i) => ({
          category: i.category,
          itemName: i.itemName.trim(),
          allocatedAmount: Number(i.allocatedAmount),
        }));

      // Auto-calculate rehab budget total from line items
      const rehabTotal = validRehabItems.length > 0
        ? validRehabItems.reduce((s, i) => s + i.allocatedAmount, 0)
        : Number(form.rehabBudgetTotal) || undefined;

      const id = await createLoan({
        borrowerId: form.borrowerId as Id<"userProfiles">,
        borrowerName: form.borrowerName,
        entityName: form.entityName,
        propertyAddress: form.propertyAddress,
        purchasePrice: Number(form.purchasePrice) || 0,
        loanAmount: Number(form.loanAmount),
        afterRepairValue: form.afterRepairValue
          ? Number(form.afterRepairValue)
          : undefined,
        rehabBudgetTotal: rehabTotal,
        closeDate: form.closeDate,
        maturityDate: form.maturityDate || undefined,
        useDefaultMaturityDate: !maturityDateEdited,
        terms: form.terms || "N/A",
        interestRate: Number(form.interestRate) || 0,
        monthlyPayment: Number(form.monthlyPayment) || 0,
        paymentDueDay: form.paymentDueDay
          ? Number(form.paymentDueDay)
          : undefined,
        pointsEarned: Number(form.pointsEarned) || 0,
        monthlyInterestEarned: form.monthlyInterestEarned
          ? Number(form.monthlyInterestEarned)
          : undefined,
        ...parsedPropertyDetails.data,
        paymentType: form.paymentType,
        status: form.status,
        titleCompany: form.titleCompany,
        titleCompanyContact: form.titleCompanyContact,
        titleCompanyContactEmail: form.titleCompanyContactEmail,
        titleCompanyContactPhone: form.titleCompanyContactPhone,
        drawFundsTotal: form.drawFundsTotal
          ? Number(form.drawFundsTotal)
          : undefined,
        drawFundsUsed: form.drawFundsUsed
          ? Number(form.drawFundsUsed)
          : undefined,
        notes: form.notes || undefined,
        rehabBudgetItems: validRehabItems.length > 0 ? validRehabItems : undefined,
      });
      router.push(`/dashboard/admin/loans/${id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create loan"));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href="/dashboard/admin/loans"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader title="New Loan" description="Create a new loan record" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Borrower Info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Borrower Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Select Borrower</label>
              <select
                value={form.borrowerId}
                onChange={(e) => handleBorrowerSelect(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select a borrower —</option>
                {(borrowers ?? []).map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.displayName}
                    {b.company ? ` (${b.company})` : ""} — {b.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Borrower Name</label>
              <input
                className={inputClass}
                value={form.borrowerName}
                onChange={(e) => update("borrowerName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Entity / LLC</label>
              <input
                className={inputClass}
                value={form.entityName}
                onChange={(e) => update("entityName", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Property Details</h3>
          <LoanPropertyFields
            idPrefix="new-loan-property"
            value={propertyDetails}
            onChange={setPropertyDetails}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Property Address</label>
              <AddressInput
                className={inputClass}
                value={form.propertyAddress}
                onChange={(e) => update("propertyAddress", e.target.value)}
                placeholder="123 Main St, City, State ZIP"
              />
            </div>
            <div>
              <label className={labelClass}>After Repair Value (ARV)</label>
              <input
                className={inputClass}
                type="number"
                value={form.afterRepairValue}
                onChange={(e) => update("afterRepairValue", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Loan Terms */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Loan Terms</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Purchase Price</label>
              <input
                className={inputClass}
                type="number"
                value={form.purchasePrice}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Rehab Budget</label>
              <input
                className={inputClass}
                type="number"
                value={rehabItemsTotal ? String(rehabItemsTotal) : form.rehabBudgetTotal}
                onChange={(e) => update("rehabBudgetTotal", e.target.value)}
                placeholder="0"
                readOnly={rehabItemsTotal > 0}
              />
              {rehabItemsTotal > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-filled from rehab budget line items.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Total Loan Amount</label>
              <input
                className={`${inputClass} font-medium`}
                type="number"
                value={form.loanAmount}
                onChange={(e) => handleLoanAmountChange(e.target.value)}
                placeholder="0"
              />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Defaults to purchase + rehab. Adjust if borrower brings cash to close.</span>
                {loanAmountEdited && (
                  <button
                    type="button"
                    onClick={resetLoanAmount}
                    className="shrink-0 font-medium text-primary hover:text-primary/80"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>Terms</label>
              <input
                className={inputClass}
                value={form.terms}
                onChange={(e) => update("terms", e.target.value)}
                placeholder='e.g. "3/13"'
              />
            </div>
            <div>
              <label className={labelClass}>Interest Rate (%)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => {
                  setInterestRateEdited(true);
                  update("interestRate", e.target.value);
                }}
                placeholder="0"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center">
                <label htmlFor="new-loan-monthly-payment" className="text-sm font-medium text-muted-foreground">Monthly Payment</label>
                <ContextTooltip
                  label="Monthly Payment"
                  content={FINANCIAL_CONTEXT.currentMonthlyPayment}
                />
              </div>
              <input
                id="new-loan-monthly-payment"
                className={`${inputClass} bg-muted/40 font-medium`}
                type="number"
                value={form.monthlyPayment}
                placeholder="0"
                readOnly
              />
            </div>
            <div>
              <label className={labelClass}>Payment Due Day</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                max="31"
                value={form.paymentDueDay}
                onChange={(e) => update("paymentDueDay", e.target.value)}
                placeholder="1-31"
              />
            </div>
            <div>
              <label className={labelClass}>Points Earned</label>
              <input
                className={`${inputClass} bg-muted/40 font-medium`}
                type="number"
                value={form.pointsEarned}
                placeholder="0"
                readOnly
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center">
                <label htmlFor="new-loan-total-interest-earned" className="text-sm font-medium text-muted-foreground">Total Interest Earned</label>
                <ContextTooltip
                  label="Total Interest Earned"
                  content={FINANCIAL_CONTEXT.totalInterestEarned}
                />
              </div>
              <input
                id="new-loan-total-interest-earned"
                className={inputClass}
                type="number"
                value={form.monthlyInterestEarned}
                onChange={(e) => update("monthlyInterestEarned", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Payment Type</label>
              <select
                className={inputClass}
                value={form.paymentType}
                onChange={(e) => update("paymentType", e.target.value)}
              >
                {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="additional_info_needed">Info Needed</option>
                <option value="approved">Approved</option>
                <option value="funded">Funded</option>
                <option value="sent_to_title">Sent to Title</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rehab Budget */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Rehab Budget</h3>
            <button
              type="button"
              onClick={() =>
                setRehabItems((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    category: "interior",
                    itemName: "",
                    allocatedAmount: "",
                  },
                ])
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-3" />
              Add Item
            </button>
          </div>

          {rehabItems.length > 0 && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total Allocated</p>
                  <p className="text-sm font-bold">
                    {formatCurrency(
                      rehabItems.reduce(
                        (s, i) => s + (Number(i.allocatedAmount) || 0),
                        0
                      )
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-sm font-bold">{rehabItems.length}</p>
                </div>
              </div>

              <div className="space-y-3">
                {rehabItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_2fr_1fr_auto]"
                  >
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Category
                      </label>
                      <select
                        className={inputClass}
                        value={item.category}
                        onChange={(e) =>
                          setRehabItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, category: e.target.value as RehabCategory }
                                : i
                            )
                          )
                        }
                      >
                        {REHAB_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Item Name
                      </label>
                      <input
                        className={inputClass}
                        placeholder="e.g. Kitchen cabinets"
                        value={item.itemName}
                        onChange={(e) =>
                          setRehabItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, itemName: e.target.value }
                                : i
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Allocated
                      </label>
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="5000"
                        value={item.allocatedAmount}
                        onChange={(e) =>
                          setRehabItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, allocatedAmount: e.target.value }
                                : i
                            )
                          )
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          setRehabItems((prev) =>
                            prev.filter((i) => i.id !== item.id)
                          )
                        }
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {rehabItems.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No budget items yet. Add items to track rehab costs.
            </p>
          )}
        </div>

        {/* Dates & Title */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">
            Dates & Title Company
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Close Date <span className="text-destructive">*</span>
              </label>
              <DatePickerField
                value={form.closeDate}
                onChange={handleCloseDateChange}
                placeholder="Select close date"
                ariaLabel="Close Date"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Maturity Date</label>
              <DatePickerField
                value={form.maturityDate}
                onChange={(value) => {
                  setMaturityDateEdited(true);
                  update("maturityDate", value);
                }}
                placeholder="Select maturity date"
                ariaLabel="Maturity Date"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-fills {defaultLoanTermMonths} months after close date. You can still edit it.
              </p>
            </div>
            {titleContacts.length > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-border bg-muted/25 p-3">
                <label className={labelClass}>Saved Title Contacts</label>
                <select
                  className={inputClass}
                  defaultValue=""
                  onChange={(e) => handleTitleContactSelect(e.target.value)}
                >
                  <option value="">Select a saved title contact…</option>
                  {titleContacts.map((contact, index) => (
                    <option key={`${contact.titleCompany}-${contact.titleCompanyContact ?? ""}-${index}`} value={index}>
                      {contact.titleCompany}{contact.titleCompanyContact ? ` — ${contact.titleCompanyContact}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  New company/contact pairs are saved to this borrower after you create the loan.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="new-loan-title-company" className={labelClass}>
                Title Company <span className="text-destructive">*</span>
              </label>
              <input
                id="new-loan-title-company"
                required
                className={inputClass}
                value={form.titleCompany}
                onChange={(e) => update("titleCompany", e.target.value)}
                placeholder="Title company name"
                autoComplete="organization"
              />
            </div>
            <div>
              <label htmlFor="new-loan-title-contact" className={labelClass}>
                Title Company Contact <span className="text-destructive">*</span>
              </label>
              <input
                id="new-loan-title-contact"
                required
                className={inputClass}
                value={form.titleCompanyContact}
                onChange={(e) => update("titleCompanyContact", e.target.value)}
                placeholder="Contact name"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="new-loan-title-contact-email" className={labelClass}>
                Title Contact Email <span className="text-destructive">*</span>
              </label>
              <input
                id="new-loan-title-contact-email"
                required
                className={inputClass}
                value={form.titleCompanyContactEmail}
                onChange={(e) => update("titleCompanyContactEmail", e.target.value)}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="new-loan-title-contact-phone" className={labelClass}>
                Title Contact Phone <span className="text-destructive">*</span>
              </label>
              <input
                id="new-loan-title-contact-phone"
                required
                className={inputClass}
                value={form.titleCompanyContactPhone}
                onChange={(e) => update("titleCompanyContactPhone", e.target.value)}
                type="tel"
                placeholder="(555) 555-5555"
                autoComplete="tel"
              />
            </div>
          </div>
        </div>

        {/* Draw Funds */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-1 text-base font-semibold">Construction Holdback</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Enter the construction holdback amount. Approved draws subtract from this amount to calculate draw remaining.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Construction Holdback Amount</label>
              <input
                className={inputClass}
                type="number"
                value={form.drawFundsTotal}
                onChange={(e) => update("drawFundsTotal", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Approved Draws Used</label>
              <input
                className={inputClass}
                type="number"
                value={form.drawFundsUsed}
                onChange={(e) => update("drawFundsUsed", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Notes</h3>
          <textarea
            className={inputClass}
            rows={4}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Additional notes about this loan..."
          />
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/dashboard/admin/loans"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || loanDefaultsLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {loanDefaultsLoading ? "Loading Defaults" : "Create Loan"}
          </button>
        </div>
      </form>
    </div>
  );
}
