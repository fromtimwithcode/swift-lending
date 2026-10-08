"use client";

import { useId, useRef, useState } from "react";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { FormDialog, FormError, formFieldClassName } from "@/components/dashboard/form-dialog";
import {
  getDefaultFirstPaymentDate,
  getInvestmentTermsError,
  getPaymentDayLabel,
  parseIsoCalendarDay,
  summarizeInvestment,
  toIsoCalendarDay,
  type InvestmentTerms,
  type InvestmentTermsError,
} from "@/convex/lib/investmentSchedule";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

export type InvestmentFormValues = InvestmentTerms & { notes?: string };

type Draft = Record<keyof InvestmentTerms | "notes", string>;

function toDraft(investment: InvestmentFormValues | null): Draft {
  return {
    investmentAmount: investment ? String(investment.investmentAmount) : "",
    interestRate: investment ? String(investment.interestRate) : "",
    inceptionDate: investment ? toIsoCalendarDay(investment.inceptionDate) : "",
    firstPaymentDate: investment ? toIsoCalendarDay(investment.firstPaymentDate) : "",
    priorPaymentsReceived: investment ? String(investment.priorPaymentsReceived) : "0",
    notes: investment?.notes ?? "",
  };
}

function parseNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function parseDraft(draft: Draft): InvestmentTerms {
  return {
    investmentAmount: parseNumber(draft.investmentAmount),
    interestRate: parseNumber(draft.interestRate),
    inceptionDate: parseIsoCalendarDay(draft.inceptionDate) ?? Number.NaN,
    firstPaymentDate: parseIsoCalendarDay(draft.firstPaymentDate) ?? Number.NaN,
    priorPaymentsReceived: parseNumber(draft.priorPaymentsReceived || "0"),
  };
}

function getDefaultFirstPayment(inceptionIso: string) {
  const inception = parseIsoCalendarDay(inceptionIso);
  return inception === null ? "" : toIsoCalendarDay(getDefaultFirstPaymentDate(inception));
}

export function InvestmentFormDialog({
  investment,
  onSave,
  onClose,
  finalFocus,
}: {
  investment: InvestmentFormValues | null;
  onSave: (values: InvestmentFormValues) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [draft, setDraft] = useState(() => toDraft(investment));
  const [firstPaymentEdited, setFirstPaymentEdited] = useState(
    () =>
      investment !== null &&
      investment.firstPaymentDate !== getDefaultFirstPaymentDate(investment.inceptionDate)
  );
  const [error, setError] = useState<InvestmentTermsError | { field: null; message: string } | null>(
    null
  );
  const amountField = useRef<HTMLInputElement>(null);
  const id = useId();
  const fieldId = (field: keyof Draft) => `${id}-${field}`;
  const errorId = `${id}-error`;

  const terms = parseDraft(draft);
  const preview = getInvestmentTermsError(terms)
    ? null
    : summarizeInvestment(terms, [], terms.inceptionDate);

  function update(field: keyof Draft, value: string) {
    setError(null);
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "inceptionDate" && !firstPaymentEdited)
        next.firstPaymentDate = getDefaultFirstPayment(value);
      return next;
    });
    if (field === "firstPaymentDate") setFirstPaymentEdited(true);
  }

  const isInvalid = (field: keyof Draft) => error?.field === field;

  function validate() {
    const termsError = getInvestmentTermsError(terms);
    setError(termsError);
    if (termsError) document.getElementById(fieldId(termsError.field))?.focus();
    return termsError === null;
  }

  async function submit() {
    try {
      await onSave({ ...terms, notes: draft.notes.trim() || undefined });
      onClose();
    } catch (err) {
      setError({ field: null, message: getErrorMessage(err, "Could not save the investment.") });
    }
  }

  const labelClassName = "mb-2 block text-sm font-medium";
  const hintClassName = "mt-2 text-xs leading-5 text-muted-foreground text-pretty";

  return (
    <FormDialog
      title={investment ? "Edit investment" : "Add investment"}
      description="Payments are calculated from these terms. Interest is paid monthly at the annual rate ÷ 12."
      submitLabel={investment ? "Save changes" : "Add investment"}
      savingLabel="Saving…"
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={amountField}
      finalFocus={finalFocus}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={fieldId("investmentAmount")} className={labelClassName}>
            Amount
          </label>
          <input
            ref={amountField}
            id={fieldId("investmentAmount")}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="100000"
            value={draft.investmentAmount}
            onChange={(event) => update("investmentAmount", event.target.value)}
            aria-invalid={isInvalid("investmentAmount") || undefined}
            aria-describedby={isInvalid("investmentAmount") ? errorId : undefined}
            className={formFieldClassName}
          />
        </div>
        <div>
          <label htmlFor={fieldId("interestRate")} className={labelClassName}>
            Annual rate (%)
          </label>
          <input
            id={fieldId("interestRate")}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            placeholder="10"
            value={draft.interestRate}
            onChange={(event) => update("interestRate", event.target.value)}
            aria-invalid={isInvalid("interestRate") || undefined}
            aria-describedby={isInvalid("interestRate") ? errorId : undefined}
            className={formFieldClassName}
          />
        </div>
        <div>
          <label htmlFor={fieldId("inceptionDate")} className={labelClassName}>
            Inception date
          </label>
          <DatePickerField
            id={fieldId("inceptionDate")}
            value={draft.inceptionDate}
            onChange={(value) => update("inceptionDate", value)}
            valueFormat="iso"
            placeholder="Select date"
            required
            ariaLabel="Inception date"
            buttonClassName="min-h-11 rounded-xl"
            ariaInvalid={isInvalid("inceptionDate")}
            ariaDescribedBy={isInvalid("inceptionDate") ? errorId : undefined}
          />
        </div>
        <div>
          <label htmlFor={fieldId("firstPaymentDate")} className={labelClassName}>
            First payment date
          </label>
          <DatePickerField
            id={fieldId("firstPaymentDate")}
            value={draft.firstPaymentDate}
            onChange={(value) => update("firstPaymentDate", value)}
            valueFormat="iso"
            placeholder="Select date"
            required
            ariaLabel="First payment date"
            buttonClassName="min-h-11 rounded-xl"
            ariaInvalid={isInvalid("firstPaymentDate")}
            ariaDescribedBy={isInvalid("firstPaymentDate") ? errorId : undefined}
          />
        </div>
      </div>
      <p className="rounded-xl bg-muted/60 p-3.5 text-sm leading-6" aria-live="polite">
        {preview && preview.nextPayment ? (
          <>
            <span className="font-medium tabular-nums">{formatCurrency(preview.monthlyPayment)}</span> a
            month, paid on {getPaymentDayLabel(terms.firstPaymentDate)}.
            {preview.nextPayment.amount !== preview.monthlyPayment && (
              <>
                {" "}The first payment is prorated to{" "}
                <span className="font-medium tabular-nums">{formatCurrency(preview.nextPayment.amount)}</span>.
              </>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">
            Enter the amount, rate, and dates to see the monthly payment. The first payment defaults
            to one month after inception.
          </span>
        )}
      </p>
      <div>
        <label htmlFor={fieldId("priorPaymentsReceived")} className={labelClassName}>
          Paid before tracking
        </label>
        <input
          id={fieldId("priorPaymentsReceived")}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draft.priorPaymentsReceived}
          onChange={(event) => update("priorPaymentsReceived", event.target.value)}
          aria-invalid={isInvalid("priorPaymentsReceived") || undefined}
          aria-describedby={`${fieldId("priorPaymentsReceived")}-hint${isInvalid("priorPaymentsReceived") ? ` ${errorId}` : ""}`}
          className={formFieldClassName}
        />
        <p id={`${fieldId("priorPaymentsReceived")}-hint`} className={hintClassName}>
          Interest already paid to this investor before payments were recorded here. Record new
          payments from the investment card.
        </p>
      </div>
      <div>
        <label htmlFor={fieldId("notes")} className={labelClassName}>
          Notes <span className="text-xs font-normal text-muted-foreground">Optional · visible to the investor</span>
        </label>
        <textarea
          id={fieldId("notes")}
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={2}
          className={`${formFieldClassName} min-h-20 resize-y`}
        />
      </div>
      <FormError id={errorId} message={error?.message ?? null} />
    </FormDialog>
  );
}
