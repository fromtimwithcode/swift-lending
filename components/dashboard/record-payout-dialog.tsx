"use client";

import { useId, useRef, useState } from "react";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { FormDialog, FormError, formFieldClassName } from "@/components/dashboard/form-dialog";
import type { Doc } from "@/convex/_generated/dataModel";
import { PAYMENT_METHOD_LABELS } from "@/convex/lib/constants";
import {
  getPayoutError,
  parseIsoCalendarDay,
  toIsoCalendarDay,
  type CalendarDay,
  type PayoutError,
} from "@/convex/lib/investmentSchedule";
import { getErrorMessage } from "@/lib/errors";

type PayoutMethod = Doc<"investorPayouts">["method"];
const PAYOUT_METHODS: PayoutMethod[] = ["ach", "wire", "check", "other"];

export type PayoutValues = {
  amount: number;
  paidDate: CalendarDay;
  method: PayoutMethod;
  notes?: string;
};

export function RecordPayoutDialog({
  investmentLabel,
  inceptionDate,
  suggestedAmount,
  today,
  onSave,
  onClose,
  finalFocus,
}: {
  investmentLabel: string;
  inceptionDate: CalendarDay;
  suggestedAmount: number | null;
  today: CalendarDay;
  onSave: (values: PayoutValues) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [paidDate, setPaidDate] = useState(toIsoCalendarDay(today));
  const [method, setMethod] = useState<PayoutMethod>("ach");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<PayoutError | { field: null; message: string } | null>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const isInvalid = (field: PayoutError["field"]) => error?.field === field;

  const values = {
    amount: amount.trim() === "" ? Number.NaN : Number(amount),
    paidDate: parseIsoCalendarDay(paidDate) ?? Number.NaN,
  };

  function validate() {
    const payoutError = getPayoutError(values, { inceptionDate }, today);
    setError(payoutError);
    if (payoutError) document.getElementById(`${id}-${payoutError.field}`)?.focus();
    return payoutError === null;
  }

  async function submit() {
    try {
      await onSave({ ...values, method, notes: notes.trim() || undefined });
      onClose();
    } catch (err) {
      setError({ field: null, message: getErrorMessage(err, "Could not record the payment.") });
    }
  }

  const labelClassName = "mb-2 block text-sm font-medium";

  return (
    <FormDialog
      title="Record investor payment"
      description={`Record interest paid on the ${investmentLabel}. Payments cover the oldest amount owed first.`}
      submitLabel="Record payment"
      savingLabel="Recording…"
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={amountField}
      finalFocus={finalFocus}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-amount`} className={labelClassName}>
            Amount
          </label>
          <input
            ref={amountField}
            id={`${id}-amount`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            aria-invalid={isInvalid("amount") || undefined}
            aria-describedby={isInvalid("amount") ? errorId : undefined}
            className={formFieldClassName}
          />
        </div>
        <div>
          <label htmlFor={`${id}-paidDate`} className={labelClassName}>
            Date paid
          </label>
          <DatePickerField
            id={`${id}-paidDate`}
            value={paidDate}
            onChange={(value) => {
              setPaidDate(value);
              setError(null);
            }}
            valueFormat="iso"
            required
            ariaLabel="Date paid"
            ariaInvalid={isInvalid("paidDate")}
            ariaDescribedBy={isInvalid("paidDate") ? errorId : undefined}
            buttonClassName="min-h-11 rounded-xl"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-method`} className={labelClassName}>
          Method
        </label>
        <select
          id={`${id}-method`}
          value={method}
          onChange={(event) =>
            setMethod(PAYOUT_METHODS.find((option) => option === event.target.value) ?? "ach")
          }
          className={formFieldClassName}
        >
          {PAYOUT_METHODS.map((option) => (
            <option key={option} value={option}>
              {PAYMENT_METHOD_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-notes`} className={labelClassName}>
          Reference <span className="text-xs font-normal text-muted-foreground">Optional · visible to the investor</span>
        </label>
        <input
          id={`${id}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Check number or confirmation"
          className={formFieldClassName}
        />
      </div>
      <FormError id={errorId} message={error?.message ?? null} />
    </FormDialog>
  );
}
