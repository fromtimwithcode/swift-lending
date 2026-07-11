"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  Building2,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { SensitiveValue } from "@/components/dashboard/sensitive-value";
import { getErrorMessage } from "@/lib/errors";

type BankAccountSummary = {
  _id: Id<"borrowerBankAccounts">;
  bankName: string;
  accountHolderName: string;
  accountType: "checking" | "savings";
  routingLast4: string;
  accountLast4: string;
  isPrimary: boolean;
};

const inputClass =
  "min-h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20";
const labelClass = "text-sm font-medium text-foreground";

const emptyAccountForm = {
  accountId: undefined as Id<"borrowerBankAccounts"> | undefined,
  bankName: "",
  accountHolderName: "",
  accountType: "checking" as "checking" | "savings",
  routingNumber: "",
  accountNumber: "",
  isPrimary: false,
};

function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function formatEin(value: string) {
  const digits = digitsOnly(value, 9);
  return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
}

function FinancialSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading financial details">
      {[0, 1].map((item) => (
        <div key={item} className="card-premium p-5 sm:p-6">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton mt-5 h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

interface BorrowerFinancialPanelProps {
  borrowerId: Id<"userProfiles">;
}

export function BorrowerFinancialPanel({ borrowerId }: BorrowerFinancialPanelProps) {
  const summary = useQuery(api.borrowerPrivate.getFinancialSummary, { borrowerId });
  const saveEin = useAction(api.borrowerPrivateActions.saveEin);
  const upsertBankAccount = useAction(api.borrowerPrivateActions.upsertBankAccount);
  const removeBankAccount = useMutation(api.borrowerPrivate.removeBankAccount);
  const revealSensitiveValue = useAction(api.borrowerPrivateActions.revealSensitiveValue);

  const [editingEin, setEditingEin] = useState(false);
  const [ein, setEin] = useState("");
  const [einError, setEinError] = useState<string | null>(null);
  const [savingEin, setSavingEin] = useState(false);
  const [accountForm, setAccountForm] = useState<typeof emptyAccountForm | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [removingAccount, setRemovingAccount] = useState<BankAccountSummary | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  if (summary === undefined) return <FinancialSkeleton />;

  const submitEin = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = digitsOnly(ein, 9);
    if (normalized.length !== 9) {
      setEinError("EIN must contain exactly 9 digits.");
      return;
    }

    setSavingEin(true);
    setEinError(null);
    try {
      await saveEin({ borrowerId, ein: normalized });
      setEin("");
      setEditingEin(false);
      toast.success("EIN saved");
    } catch (cause) {
      setEinError(getErrorMessage(cause, "Couldn't save EIN"));
    } finally {
      setSavingEin(false);
    }
  };

  const openNewAccount = () => {
    setAccountError(null);
    setAccountForm({ ...emptyAccountForm, isPrimary: summary.accounts.length === 0 });
  };

  const openAccountEdit = (account: BankAccountSummary) => {
    setAccountError(null);
    setAccountForm({
      accountId: account._id,
      bankName: account.bankName,
      accountHolderName: account.accountHolderName,
      accountType: account.accountType,
      routingNumber: "",
      accountNumber: "",
      isPrimary: account.isPrimary,
    });
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountForm) return;
    if (!accountForm.bankName.trim() || !accountForm.accountHolderName.trim()) {
      setAccountError("Bank name and account holder are required.");
      return;
    }
    if (!accountForm.accountId && (!accountForm.routingNumber || !accountForm.accountNumber)) {
      setAccountError("Routing and account numbers are required.");
      return;
    }
    if (
      accountForm.accountId &&
      Boolean(accountForm.routingNumber) !== Boolean(accountForm.accountNumber)
    ) {
      setAccountError("Enter both routing and account numbers to replace bank details.");
      return;
    }

    setSavingAccount(true);
    setAccountError(null);
    try {
      await upsertBankAccount({
        borrowerId,
        accountId: accountForm.accountId,
        bankName: accountForm.bankName,
        accountHolderName: accountForm.accountHolderName,
        accountType: accountForm.accountType,
        routingNumber: accountForm.routingNumber || undefined,
        accountNumber: accountForm.accountNumber || undefined,
        isPrimary: accountForm.isPrimary,
      });
      toast.success(accountForm.accountId ? "Bank account updated" : "Bank account added");
      setAccountForm(null);
    } catch (cause) {
      setAccountError(getErrorMessage(cause, "Couldn't save bank account"));
    } finally {
      setSavingAccount(false);
    }
  };

  const confirmRemoveAccount = async () => {
    if (!removingAccount) return;
    setRemoveLoading(true);
    try {
      await removeBankAccount({ borrowerId, accountId: removingAccount._id });
      toast.success("Bank account removed");
      setRemovingAccount(null);
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Couldn't remove bank account"));
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card-premium overflow-hidden" aria-labelledby="tax-id-heading">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-foreground">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="tax-id-heading" className="text-base font-semibold text-balance">
                Tax identification
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
                The entity EIN is encrypted and hidden by default.
              </p>
            </div>
          </div>
          {!editingEin && (
            <Button variant="outline" size="lg" onClick={() => setEditingEin(true)}>
              {summary.ein ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {summary.ein ? "Update EIN" : "Add EIN"}
            </Button>
          )}
        </div>

        <div className="border-t border-border/70 p-5 sm:p-6">
          {editingEin ? (
            <form onSubmit={submitEin} className="max-w-md space-y-4" aria-busy={savingEin}>
              <div className="space-y-1.5">
                <label htmlFor="borrower-ein" className={labelClass}>
                  Employer identification number
                </label>
                <input
                  id="borrower-ein"
                  className={inputClass}
                  value={formatEin(ein)}
                  onChange={(event) => setEin(digitsOnly(event.target.value, 9))}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="12-3456789"
                  aria-invalid={einError ? "true" : undefined}
                  aria-describedby={einError ? "borrower-ein-error" : "borrower-ein-help"}
                />
                {einError ? (
                  <p id="borrower-ein-error" className="text-xs text-destructive" role="alert">
                    {einError}
                  </p>
                ) : (
                  <p id="borrower-ein-help" className="text-xs text-muted-foreground">
                    Enter all 9 digits. The value is encrypted before storage.
                  </p>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setEditingEin(false);
                    setEin("");
                    setEinError(null);
                  }}
                  disabled={savingEin}
                >
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={savingEin}>
                  {savingEin && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Save EIN
                </Button>
              </div>
            </form>
          ) : summary.ein ? (
            <SensitiveValue
              label="EIN"
              maskedValue={`••-•••${summary.ein.last4}`}
              formatValue={formatEin}
              onReveal={() => revealSensitiveValue({ borrowerId, field: "ein" })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No EIN saved yet.</p>
          )}
        </div>
      </section>

      <section className="card-premium overflow-hidden" aria-labelledby="bank-accounts-heading">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary dark:bg-secondary/25 dark:text-foreground">
              <Landmark className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="bank-accounts-heading" className="text-base font-semibold text-balance">
                ACH bank accounts
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
                Store payment details for internal reference.
              </p>
            </div>
          </div>
          {!accountForm && (
            <Button size="lg" onClick={openNewAccount}>
              <Plus aria-hidden="true" />
              Add account
            </Button>
          )}
        </div>

        <div className="mx-5 mb-5 flex gap-3 rounded-2xl bg-muted/60 p-4 sm:mx-6 sm:mb-6">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary dark:text-primary" aria-hidden="true" />
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            Account values are encrypted and every reveal is logged. Saving details here does not authorize an ACH debit.
          </p>
        </div>

        {accountForm && (
          <form
            onSubmit={submitAccount}
            className="border-y border-border/70 bg-muted/25 p-5 sm:p-6"
            aria-busy={savingAccount}
          >
            <fieldset className="space-y-5">
              <legend className="text-sm font-semibold">
                {accountForm.accountId ? "Edit bank account" : "New bank account"}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="bank-name" className={labelClass}>Bank name</label>
                  <input
                    id="bank-name"
                    className={inputClass}
                    value={accountForm.bankName}
                    onChange={(event) => setAccountForm({ ...accountForm, bankName: event.target.value })}
                    autoComplete="organization"
                    spellCheck={false}
                    placeholder="First National Bank"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="account-holder" className={labelClass}>Account holder</label>
                  <input
                    id="account-holder"
                    className={inputClass}
                    value={accountForm.accountHolderName}
                    onChange={(event) => setAccountForm({ ...accountForm, accountHolderName: event.target.value })}
                    autoComplete="name"
                    spellCheck={false}
                    placeholder="Account holder name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="account-type" className={labelClass}>Account type</label>
                  <select
                    id="account-type"
                    className={inputClass}
                    value={accountForm.accountType}
                    onChange={(event) =>
                      setAccountForm({
                        ...accountForm,
                        accountType: event.target.value as "checking" | "savings",
                      })
                    }
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-1 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={accountForm.isPrimary}
                      onChange={(event) => setAccountForm({ ...accountForm, isPrimary: event.target.checked })}
                      className="size-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    Primary account
                  </label>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="routing-number" className={labelClass}>Routing number</label>
                  <input
                    id="routing-number"
                    className={inputClass}
                    value={accountForm.routingNumber}
                    onChange={(event) =>
                      setAccountForm({ ...accountForm, routingNumber: digitsOnly(event.target.value, 9) })
                    }
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={accountForm.accountId ? "Leave blank to keep current" : "9 digits"}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="account-number" className={labelClass}>Account number</label>
                  <input
                    id="account-number"
                    className={inputClass}
                    value={accountForm.accountNumber}
                    onChange={(event) =>
                      setAccountForm({ ...accountForm, accountNumber: digitsOnly(event.target.value, 17) })
                    }
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={accountForm.accountId ? "Leave blank to keep current" : "4–17 digits"}
                  />
                </div>
                {accountForm.accountId && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Leave both number fields blank to keep the saved details, or enter both to replace them.
                  </p>
                )}
              </div>
              {accountError && (
                <p className="text-sm text-destructive" role="alert">{accountError}</p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setAccountForm(null);
                    setAccountError(null);
                  }}
                  disabled={savingAccount}
                >
                  <X aria-hidden="true" />
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={savingAccount}>
                  {savingAccount && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Save account
                </Button>
              </div>
            </fieldset>
          </form>
        )}

        <div className="p-5 sm:p-6">
          {summary.accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Landmark className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">No bank accounts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add an account to keep ACH details with this borrower.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {summary.accounts.map((account) => (
                <article key={account._id} className="rounded-2xl bg-muted/45 p-4 shadow-[inset_0_0_0_1px_var(--border)] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{account.bankName}</h3>
                        {account.isPrimary && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold">Primary</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {account.accountHolderName} · {account.accountType}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openAccountEdit(account)}
                        aria-label={`Edit ${account.bankName} account`}
                        className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingAccount(account)}
                        aria-label={`Remove ${account.bankName} account`}
                        className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <SensitiveValue
                      label="Routing number"
                      maskedValue={`•••••${account.routingLast4}`}
                      onReveal={() =>
                        revealSensitiveValue({
                          borrowerId,
                          accountId: account._id,
                          field: "routing_number",
                        })
                      }
                    />
                    <SensitiveValue
                      label="Account number"
                      maskedValue={`••••${account.accountLast4}`}
                      onReveal={() =>
                        revealSensitiveValue({
                          borrowerId,
                          accountId: account._id,
                          field: "account_number",
                        })
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={removingAccount !== null}
        title="Remove bank account?"
        description="The encrypted routing and account numbers will be permanently removed."
        confirmLabel="Remove account"
        variant="destructive"
        loading={removeLoading}
        onConfirm={confirmRemoveAccount}
        onCancel={() => setRemovingAccount(null)}
      />
    </div>
  );
}
