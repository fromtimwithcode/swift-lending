"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { getErrorMessage } from "@/lib/errors";

type RelatedParty = {
  _id: Id<"borrowerRelatedParties">;
  type: "co_borrower" | "guarantor" | "member" | "spouse" | "other";
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  relationship?: string;
  notes?: string;
};
type PartyType = RelatedParty["type"];

const partyTypeOptions: { value: PartyType; label: string }[] = [
  { value: "co_borrower", label: "Co-borrower" },
  { value: "guarantor", label: "Guarantor" },
  { value: "member", label: "Member / owner" },
  { value: "spouse", label: "Spouse" },
  { value: "other", label: "Other" },
];

const partyTypeLabels = Object.fromEntries(
  partyTypeOptions.map((option) => [option.value, option.label])
) as Record<PartyType, string>;

const inputClass =
  "min-h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20";
const labelClass = "text-sm font-medium text-foreground";

const emptyPartyForm = {
  partyId: undefined as Id<"borrowerRelatedParties"> | undefined,
  type: "co_borrower" as PartyType,
  fullName: "",
  email: "",
  phone: "",
  company: "",
  relationship: "",
  notes: "",
};

function PartiesSkeleton() {
  return (
    <div className="card-premium p-5 sm:p-6" aria-label="Loading related parties">
      <div className="skeleton h-5 w-44" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </div>
  );
}

interface BorrowerRelatedPartiesPanelProps {
  borrowerId: Id<"userProfiles">;
}

export function BorrowerRelatedPartiesPanel({ borrowerId }: BorrowerRelatedPartiesPanelProps) {
  const parties = useQuery(api.borrowerPrivate.listRelatedParties, { borrowerId });
  const upsertParty = useMutation(api.borrowerPrivate.upsertRelatedParty);
  const removeParty = useMutation(api.borrowerPrivate.removeRelatedParty);
  const [partyForm, setPartyForm] = useState<typeof emptyPartyForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingParty, setRemovingParty] = useState<RelatedParty | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  if (parties === undefined) return <PartiesSkeleton />;

  const openEdit = (party: RelatedParty) => {
    setFormError(null);
    setPartyForm({
      partyId: party._id,
      type: party.type,
      fullName: party.fullName,
      email: party.email ?? "",
      phone: party.phone ?? "",
      company: party.company ?? "",
      relationship: party.relationship ?? "",
      notes: party.notes ?? "",
    });
  };

  const submitParty = async (event: FormEvent) => {
    event.preventDefault();
    if (!partyForm) return;
    if (!partyForm.fullName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (partyForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partyForm.email)) {
      setFormError("Enter a valid email address.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await upsertParty({
        borrowerId,
        partyId: partyForm.partyId,
        type: partyForm.type,
        fullName: partyForm.fullName,
        email: partyForm.email || undefined,
        phone: partyForm.phone || undefined,
        company: partyForm.company || undefined,
        relationship: partyForm.relationship || undefined,
        notes: partyForm.notes || undefined,
      });
      toast.success(partyForm.partyId ? "Related party updated" : "Related party added");
      setPartyForm(null);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't save related party"));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removingParty) return;
    setRemoveLoading(true);
    try {
      await removeParty({ borrowerId, partyId: removingParty._id });
      toast.success("Related party removed");
      setRemovingParty(null);
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Couldn't remove related party"));
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <section className="card-premium overflow-hidden" aria-labelledby="related-parties-heading">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-foreground">
            <UsersRound className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="related-parties-heading" className="text-base font-semibold text-balance">
              Related parties
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
              Keep co-borrowers, guarantors, members, and other contacts together.
            </p>
          </div>
        </div>
        {!partyForm && (
          <Button size="lg" onClick={() => setPartyForm({ ...emptyPartyForm })}>
            <Plus aria-hidden="true" />
            Add party
          </Button>
        )}
      </div>

      {partyForm && (
        <form
          onSubmit={submitParty}
          className="border-y border-border/70 bg-muted/25 p-5 sm:p-6"
          aria-busy={saving}
        >
          <fieldset className="space-y-5">
            <legend className="text-sm font-semibold">
              {partyForm.partyId ? "Edit related party" : "New related party"}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="party-type" className={labelClass}>Party type</label>
                <select
                  id="party-type"
                  className={inputClass}
                  value={partyForm.type}
                  onChange={(event) => setPartyForm({ ...partyForm, type: event.target.value as PartyType })}
                >
                  {partyTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="party-name" className={labelClass}>Full name</label>
                <input
                  id="party-name"
                  className={inputClass}
                  value={partyForm.fullName}
                  onChange={(event) => setPartyForm({ ...partyForm, fullName: event.target.value })}
                  autoComplete="name"
                  spellCheck={false}
                  placeholder="Jordan Smith"
                  aria-invalid={formError && !partyForm.fullName.trim() ? "true" : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="party-email" className={labelClass}>Email</label>
                <input
                  id="party-email"
                  className={inputClass}
                  value={partyForm.email}
                  onChange={(event) => setPartyForm({ ...partyForm, email: event.target.value })}
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="jordan@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="party-phone" className={labelClass}>Phone</label>
                <input
                  id="party-phone"
                  className={inputClass}
                  value={partyForm.phone}
                  onChange={(event) => setPartyForm({ ...partyForm, phone: event.target.value })}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  spellCheck={false}
                  placeholder="(555) 555-0123"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="party-company" className={labelClass}>Company / entity</label>
                <input
                  id="party-company"
                  className={inputClass}
                  value={partyForm.company}
                  onChange={(event) => setPartyForm({ ...partyForm, company: event.target.value })}
                  autoComplete="organization"
                  spellCheck={false}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="party-relationship" className={labelClass}>Relationship / title</label>
                <input
                  id="party-relationship"
                  className={inputClass}
                  value={partyForm.relationship}
                  onChange={(event) => setPartyForm({ ...partyForm, relationship: event.target.value })}
                  spellCheck={false}
                  placeholder="Managing member"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="party-notes" className={labelClass}>Notes</label>
                <textarea
                  id="party-notes"
                  className={`${inputClass} min-h-24 resize-y`}
                  value={partyForm.notes}
                  onChange={(event) => setPartyForm({ ...partyForm, notes: event.target.value })}
                  placeholder="Optional context about this party"
                  maxLength={1000}
                />
              </div>
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">{formError}</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  setPartyForm(null);
                  setFormError(null);
                }}
                disabled={saving}
              >
                <X aria-hidden="true" />
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                Save party
              </Button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="p-5 sm:p-6">
        {parties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <UserRound className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">No related parties yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add anyone connected to this borrower or their entity.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {parties.map((party) => (
              <article key={party._id} className="rounded-2xl bg-muted/45 p-4 shadow-[inset_0_0_0_1px_var(--border)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold">
                      {partyTypeLabels[party.type]}
                    </span>
                    <h3 className="mt-2 truncate text-sm font-semibold">{party.fullName}</h3>
                    {party.relationship && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">{party.relationship}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(party)}
                      aria-label={`Edit ${party.fullName}`}
                      className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemovingParty(party)}
                      aria-label={`Remove ${party.fullName}`}
                      className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {party.company && (
                    <p className="flex min-w-0 items-center gap-2">
                      <Building2 className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{party.company}</span>
                    </p>
                  )}
                  {party.email && (
                    <p className="flex min-w-0 items-center gap-2">
                      <Mail className="size-4 shrink-0" aria-hidden="true" />
                      <a className="truncate hover:text-foreground hover:underline" href={`mailto:${party.email}`}>
                        {party.email}
                      </a>
                    </p>
                  )}
                  {party.phone && (
                    <p className="flex min-w-0 items-center gap-2">
                      <Phone className="size-4 shrink-0" aria-hidden="true" />
                      <a className="truncate hover:text-foreground hover:underline" href={`tel:${party.phone}`}>
                        {party.phone}
                      </a>
                    </p>
                  )}
                  {party.notes && (
                    <p className="border-t border-border/70 pt-3 text-sm leading-6 text-pretty">{party.notes}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removingParty !== null}
        title={`Remove ${removingParty?.fullName ?? "related party"}?`}
        description="This contact will be removed from the borrower record."
        confirmLabel="Remove party"
        variant="destructive"
        loading={removeLoading}
        onConfirm={confirmRemove}
        onCancel={() => setRemovingParty(null)}
      />
    </section>
  );
}
