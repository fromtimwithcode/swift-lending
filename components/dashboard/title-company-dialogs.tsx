"use client";

import { useId, useRef, useState, type ComponentProps } from "react";
import { FormDialog, FormError, formFieldClassName } from "@/components/dashboard/form-dialog";
import { EMAIL_REGEX } from "@/convex/lib/borrowerPrivateValidation";
import { TITLE_COMPANY_LIMITS as LIMITS } from "@/convex/lib/titleCompanies";
import { getErrorMessage } from "@/lib/errors";

const labelClassName = "mb-2 block text-sm font-medium";
const hintClassName = "mt-2 text-xs leading-5 text-muted-foreground text-pretty";

type FieldError<Field extends string> = { field: Field | null; message: string } | null;

function FieldLabel({ htmlFor, label, optional }: { htmlFor: string; label: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={labelClassName}>
      {label}
      {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Optional</span>}
    </label>
  );
}

function describedBy(...ids: (string | false | null | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

function TextField({
  id,
  label,
  optional,
  hint,
  invalid,
  errorId,
  ...props
}: Omit<ComponentProps<"input">, "id" | "className"> & {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  invalid: boolean;
  errorId: string;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(hint && hintId, invalid && errorId)}
        className={formFieldClassName}
        {...props}
      />
      {hint && (
        <p id={hintId} className={hintClassName}>
          {hint}
        </p>
      )}
    </div>
  );
}

function NotesField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} optional />
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={LIMITS.notes}
        aria-describedby={hint ? hintId : undefined}
        className={`${formFieldClassName} min-h-24 resize-y`}
      />
      {hint && (
        <p id={hintId} className={hintClassName}>
          {hint}
        </p>
      )}
    </div>
  );
}

function optional(value: string) {
  return value.trim() || undefined;
}

function isValidEmail(value: string) {
  const email = value.trim();
  return !email || EMAIL_REGEX.test(email);
}

export type TitleCompanyFormValues = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

type CompanyField = keyof TitleCompanyFormValues;

export function TitleCompanyFormDialog({
  company,
  onSave,
  onClose,
  finalFocus,
}: {
  company: TitleCompanyFormValues | null;
  onSave: (values: TitleCompanyFormValues) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [draft, setDraft] = useState<Record<CompanyField, string>>({
    name: company?.name ?? "",
    phone: company?.phone ?? "",
    email: company?.email ?? "",
    address: company?.address ?? "",
    notes: company?.notes ?? "",
  });
  const [error, setError] = useState<FieldError<CompanyField>>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const id = useId();
  const fieldId = (field: CompanyField) => `${id}-${field}`;
  const errorId = `${id}-error`;

  function update(field: CompanyField, value: string) {
    setError(null);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function fail(field: CompanyField, message: string) {
    setError({ field, message });
    document.getElementById(fieldId(field))?.focus();
    return false;
  }

  function validate() {
    if (!draft.name.trim()) return fail("name", "Enter the title company's name.");
    if (!isValidEmail(draft.email)) return fail("email", "Enter a valid email address.");
    return true;
  }

  async function submit() {
    try {
      await onSave({
        name: draft.name.trim(),
        phone: optional(draft.phone),
        email: optional(draft.email),
        address: optional(draft.address),
        notes: optional(draft.notes),
      });
      onClose();
    } catch (err) {
      setError({ field: null, message: getErrorMessage(err, "Could not save the title company.") });
    }
  }

  const fieldProps = (field: Exclude<CompanyField, "notes">) => ({
    id: fieldId(field),
    value: draft[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(field, event.target.value),
    invalid: error?.field === field,
    errorId,
    spellCheck: false,
  });

  return (
    <FormDialog
      title={company ? "Edit title company" : "Add title company"}
      description="Main contact details for the company. Add people and wire instructions from its page."
      submitLabel={company ? "Save changes" : "Add title company"}
      savingLabel="Saving…"
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={nameField}
      finalFocus={finalFocus}
    >
      <TextField
        ref={nameField}
        label="Company name"
        autoComplete="organization"
        maxLength={LIMITS.name}
        {...fieldProps("name")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Main phone"
          optional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={LIMITS.phone}
          {...fieldProps("phone")}
        />
        <TextField
          label="Main email"
          optional
          type="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          {...fieldProps("email")}
        />
      </div>
      <TextField
        label="Address"
        optional
        autoComplete="street-address"
        maxLength={LIMITS.address}
        {...fieldProps("address")}
      />
      <NotesField
        id={fieldId("notes")}
        label="Notes"
        hint="Internal only. Hours, ordering preferences, or anything else worth knowing."
        value={draft.notes}
        onChange={(value) => update("notes", value)}
      />
      <FormError id={errorId} message={error?.message ?? null} />
    </FormDialog>
  );
}

export type TitleCompanyContactValues = {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
};

type ContactField = keyof TitleCompanyContactValues;

export function TitleCompanyContactDialog({
  contact,
  companyName,
  onSave,
  onClose,
  finalFocus,
}: {
  contact: TitleCompanyContactValues | null;
  companyName: string;
  onSave: (values: TitleCompanyContactValues) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [draft, setDraft] = useState<Record<ContactField, string>>({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
  });
  const [error, setError] = useState<FieldError<ContactField>>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const id = useId();
  const fieldId = (field: ContactField) => `${id}-${field}`;
  const errorId = `${id}-error`;

  function update(field: ContactField, value: string) {
    setError(null);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function fail(field: ContactField, message: string) {
    setError({ field, message });
    document.getElementById(fieldId(field))?.focus();
    return false;
  }

  function validate() {
    if (!draft.name.trim()) return fail("name", "Enter the contact's name.");
    if (!isValidEmail(draft.email)) return fail("email", "Enter a valid email address.");
    return true;
  }

  async function submit() {
    try {
      await onSave({
        name: draft.name.trim(),
        role: optional(draft.role),
        phone: optional(draft.phone),
        email: optional(draft.email),
      });
      onClose();
    } catch (err) {
      setError({ field: null, message: getErrorMessage(err, "Could not save the contact.") });
    }
  }

  const fieldProps = (field: ContactField) => ({
    id: fieldId(field),
    value: draft[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(field, event.target.value),
    invalid: error?.field === field,
    errorId,
    spellCheck: false,
  });

  return (
    <FormDialog
      title={contact ? "Edit contact" : "Add contact"}
      description={`Someone you work with at ${companyName}.`}
      submitLabel={contact ? "Save changes" : "Add contact"}
      savingLabel="Saving…"
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={nameField}
      finalFocus={finalFocus}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          ref={nameField}
          label="Name"
          autoComplete="name"
          maxLength={LIMITS.name}
          {...fieldProps("name")}
        />
        <TextField
          label="Role"
          optional
          placeholder="Escrow officer"
          maxLength={LIMITS.contactRole}
          {...fieldProps("role")}
        />
        <TextField
          label="Phone"
          optional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={LIMITS.phone}
          {...fieldProps("phone")}
        />
        <TextField
          label="Email"
          optional
          type="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          {...fieldProps("email")}
        />
      </div>
      <FormError id={errorId} message={error?.message ?? null} />
    </FormDialog>
  );
}

export type WireInstructionsValues = {
  bankName: string;
  accountName: string;
  routingNumber?: string;
  accountNumber?: string;
  notes?: string;
};

export type SavedWireInstructions = {
  bankName: string;
  accountName: string;
  routingLast4: string;
  accountLast4: string;
  notes?: string;
};

type WireField = keyof WireInstructionsValues;

function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function WireInstructionsDialog({
  saved,
  companyName,
  onSave,
  onClose,
  finalFocus,
}: {
  saved: SavedWireInstructions | null;
  companyName: string;
  onSave: (values: WireInstructionsValues) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [draft, setDraft] = useState<Record<WireField, string>>({
    bankName: saved?.bankName ?? "",
    accountName: saved?.accountName ?? "",
    routingNumber: "",
    accountNumber: "",
    notes: saved?.notes ?? "",
  });
  const [error, setError] = useState<FieldError<WireField>>(null);
  const bankField = useRef<HTMLInputElement>(null);
  const id = useId();
  const fieldId = (field: WireField) => `${id}-${field}`;
  const errorId = `${id}-error`;
  const numbersHintId = `${id}-numbers-hint`;

  function update(field: WireField, value: string) {
    setError(null);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function fail(field: WireField, message: string) {
    setError({ field, message });
    document.getElementById(fieldId(field))?.focus();
    return false;
  }

  function validate() {
    const { routingNumber, accountNumber } = draft;
    if (!draft.bankName.trim()) return fail("bankName", "Enter the bank's name.");
    if (!draft.accountName.trim()) return fail("accountName", "Enter the account name.");
    if (!saved || routingNumber || accountNumber) {
      if (!routingNumber)
        return fail("routingNumber", saved ? "Enter both numbers to replace them, or leave both blank." : "Enter the routing number.");
      if (routingNumber.length !== 9) return fail("routingNumber", "Routing number must contain exactly 9 digits.");
      if (!accountNumber)
        return fail("accountNumber", saved ? "Enter both numbers to replace them, or leave both blank." : "Enter the account number.");
      if (accountNumber.length < 4) return fail("accountNumber", "Account number must contain 4 to 17 digits.");
    }
    return true;
  }

  async function submit() {
    try {
      await onSave({
        bankName: draft.bankName.trim(),
        accountName: draft.accountName.trim(),
        routingNumber: draft.routingNumber || undefined,
        accountNumber: draft.accountNumber || undefined,
        notes: optional(draft.notes),
      });
      onClose();
    } catch (err) {
      setError({ field: null, message: getErrorMessage(err, "Could not save the wire instructions.") });
    }
  }

  const isInvalid = (field: WireField) => error?.field === field;
  const numberProps = (field: "routingNumber" | "accountNumber", maxLength: number) => ({
    id: fieldId(field),
    value: draft[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(field, digitsOnly(event.target.value, maxLength)),
    inputMode: "numeric" as const,
    autoComplete: "off",
    spellCheck: false,
    placeholder: saved ? "Leave blank to keep" : undefined,
    "aria-invalid": isInvalid(field) || undefined,
    "aria-describedby": describedBy(saved && numbersHintId, isInvalid(field) && errorId),
    className: `${formFieldClassName} font-mono tabular-nums`,
  });

  return (
    <FormDialog
      title={saved ? "Edit wire instructions" : "Add wire instructions"}
      description={`Where to wire closing funds for ${companyName}. Numbers are encrypted and every reveal is logged.`}
      submitLabel={saved ? "Save changes" : "Save wire instructions"}
      savingLabel="Saving…"
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={bankField}
      finalFocus={finalFocus}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          ref={bankField}
          id={fieldId("bankName")}
          label="Bank name"
          value={draft.bankName}
          onChange={(event) => update("bankName", event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={LIMITS.bankName}
          invalid={isInvalid("bankName")}
          errorId={errorId}
        />
        <TextField
          id={fieldId("accountName")}
          label="Account name"
          hint="The beneficiary on the account."
          value={draft.accountName}
          onChange={(event) => update("accountName", event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={LIMITS.accountName}
          invalid={isInvalid("accountName")}
          errorId={errorId}
        />
        <div className="min-w-0">
          <FieldLabel htmlFor={fieldId("routingNumber")} label="Routing number" />
          <input {...numberProps("routingNumber", 9)} />
        </div>
        <div className="min-w-0">
          <FieldLabel htmlFor={fieldId("accountNumber")} label="Account number" />
          <input {...numberProps("accountNumber", 17)} />
        </div>
      </div>
      {saved && (
        <p id={numbersHintId} className="-mt-2 text-xs leading-5 text-muted-foreground text-pretty">
          Leave both numbers blank to keep the saved ones (routing ending{" "}
          <span className="tabular-nums">{saved.routingLast4}</span>, account ending{" "}
          <span className="tabular-nums">{saved.accountLast4}</span>), or enter both to replace them.
        </p>
      )}
      <NotesField
        id={fieldId("notes")}
        label="Wire notes"
        hint="Reference to include, for further credit to, bank address, or other details."
        value={draft.notes}
        onChange={(value) => update("notes", value)}
      />
      <FormError id={errorId} message={error?.message ?? null} />
    </FormDialog>
  );
}
