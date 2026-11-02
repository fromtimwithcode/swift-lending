"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, Building2, Mail, Pencil, Phone, Plus, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_TITLE_COMPANY_CONTACTS } from "@/convex/lib/titleCompanies";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SensitiveValue } from "@/components/dashboard/sensitive-value";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import {
  TitleCompanyContactDialog,
  TitleCompanyFormDialog,
  WireInstructionsDialog,
} from "@/components/dashboard/title-company-dialogs";
import { getErrorMessage } from "@/lib/errors";

type Company = NonNullable<FunctionReturnType<typeof api.titleCompanies.get>>;
type Contact = Company["contacts"][number];

const LIST_HREF = "/dashboard/admin/title-companies";

const cardClassName = "rounded-xl border border-border bg-card p-4 outline-none sm:p-6";
const headingClassName = "text-[13px] font-bold uppercase tracking-wide text-foreground";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary";
const outlineButtonClassName = `inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted ${focusRing}`;
const primaryButtonClassName = `inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 ${focusRing}`;
const destructiveButtonClassName = `inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 ${focusRing}`;
const iconButtonClassName = `inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${focusRing}`;
const linkClassName = `inline-flex min-h-10 max-w-full items-center gap-2 rounded-md text-sm hover:underline ${focusRing}`;

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function Detail({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`} className={linkClassName}>
      <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate tabular-nums">{phone}</span>
    </a>
  );
}

function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className={linkClassName}>
      <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{email}</span>
    </a>
  );
}

function useDialogFocus<T>() {
  const [dialog, setDialog] = useState<T | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const section = useRef<HTMLElement>(null);
  return {
    dialog,
    section,
    open: (next: T, element: HTMLElement) => {
      trigger.current = element;
      setDialog(next);
    },
    close: () => setDialog(null),
    finalFocus: () => (trigger.current?.isConnected ? trigger.current : section.current),
  };
}

function ContactsCard({ company }: { company: Company }) {
  const upsertContact = useMutation(api.titleCompanies.upsertContact);
  const removeContact = useMutation(api.titleCompanies.removeContact);
  const { dialog, section, open, close, finalFocus } = useDialogFocus<
    { kind: "edit"; contact: Contact | null } | { kind: "remove"; contact: Contact }
  >();
  const [removing, setRemoving] = useState(false);
  const { contacts } = company;

  async function confirmRemove() {
    if (dialog?.kind !== "remove") return;
    setRemoving(true);
    try {
      await removeContact({ titleCompanyId: company._id, contactId: dialog.contact._id });
      toast.success("Contact removed");
      close();
      finalFocus()?.focus();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove the contact."));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section ref={section} tabIndex={-1} aria-labelledby="title-company-contacts-heading" className={cardClassName}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="title-company-contacts-heading" className={headingClassName}>
          Contacts <span className="text-muted-foreground tabular-nums">({contacts.length})</span>
        </h2>
        {contacts.length < MAX_TITLE_COMPANY_CONTACTS ? (
          <button
            type="button"
            onClick={(event) => open({ kind: "edit", contact: null }, event.currentTarget)}
            className={primaryButtonClassName}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add contact
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Contact limit reached (<span className="tabular-nums">{MAX_TITLE_COMPANY_CONTACTS}</span>)
          </p>
        )}
      </div>

      {contacts.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {contacts.map((contact) => (
            <li key={contact._id} aria-label={contact.name} className="min-w-0 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-1">
                  <h3 className="truncate text-sm font-semibold">{contact.name}</h3>
                  {contact.role && <p className="mt-0.5 truncate text-sm text-muted-foreground">{contact.role}</p>}
                </div>
                <div className="-mr-2 -mt-2 flex shrink-0">
                  <button
                    type="button"
                    onClick={(event) => open({ kind: "edit", contact }, event.currentTarget)}
                    aria-label={`Edit ${contact.name}`}
                    className={iconButtonClassName}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => open({ kind: "remove", contact }, event.currentTarget)}
                    aria-label={`Remove ${contact.name}`}
                    className={`${iconButtonClassName} hover:text-destructive`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {(contact.phone || contact.email) && (
                <div className="mt-2 flex min-w-0 flex-col items-start">
                  {contact.phone && <PhoneLink phone={contact.phone} />}
                  {contact.email && <EmailLink email={contact.email} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No contacts yet. Add the escrow officers and closers you work with.
        </p>
      )}

      {dialog?.kind === "edit" && (
        <TitleCompanyContactDialog
          contact={dialog.contact}
          companyName={company.name}
          onSave={async (values) => {
            await upsertContact({ titleCompanyId: company._id, contactId: dialog.contact?._id, ...values });
            toast.success(dialog.contact ? "Contact updated" : "Contact added");
          }}
          onClose={close}
          finalFocus={finalFocus}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === "remove"}
        title={`Remove ${dialog?.contact?.name ?? "contact"}?`}
        description={`They will be removed from ${company.name}'s contacts.`}
        confirmLabel="Remove contact"
        variant="destructive"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={close}
      />
    </section>
  );
}

function WireInstructionsCard({ company }: { company: Company }) {
  const saveWireInstructions = useAction(api.titleCompanyActions.saveWireInstructions);
  const revealWireValue = useAction(api.titleCompanyActions.revealWireValue);
  const removeWireInstructions = useMutation(api.titleCompanies.removeWireInstructions);
  const { dialog, section, open, close, finalFocus } = useDialogFocus<"edit" | "remove">();
  const [removing, setRemoving] = useState(false);
  const wire = company.wireInstructions;

  async function confirmRemove() {
    setRemoving(true);
    try {
      await removeWireInstructions({ titleCompanyId: company._id });
      toast.success("Wire instructions removed");
      close();
      finalFocus()?.focus();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove the wire instructions."));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section ref={section} tabIndex={-1} aria-labelledby="title-company-wire-heading" className={cardClassName}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="title-company-wire-heading" className={headingClassName}>
          Wire instructions
        </h2>
        {wire ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => open("edit", event.currentTarget)}
              className={outlineButtonClassName}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => open("remove", event.currentTarget)}
              className={destructiveButtonClassName}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(event) => open("edit", event.currentTarget)}
            className={primaryButtonClassName}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add wire instructions
          </button>
        )}
      </div>

      <div className="flex gap-3 rounded-lg bg-muted/60 p-4">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="text-sm leading-6 text-pretty">
          <span className="font-semibold">Confirm by phone before sending funds.</span> Call a contact you
          already know at {company.name}, at a number you trust, and have them confirm these instructions.
          Treat emailed changes as suspect until you do.
        </p>
      </div>

      {wire ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Detail label="Bank name">{wire.bankName}</Detail>
            <Detail label="Account name">{wire.accountName}</Detail>
            <SensitiveValue
              key={`routing-${wire.updatedAt}`}
              label="Routing number"
              maskedValue={`•••• ${wire.routingLast4}`}
              onReveal={() => revealWireValue({ titleCompanyId: company._id, field: "routing_number" })}
            />
            <SensitiveValue
              key={`account-${wire.updatedAt}`}
              label="Account number"
              maskedValue={`•••• ${wire.accountLast4}`}
              onReveal={() => revealWireValue({ titleCompanyId: company._id, field: "account_number" })}
            />
            {wire.notes && (
              <Detail label="Wire notes" wide>
                <p className="whitespace-pre-wrap font-normal">{wire.notes}</p>
              </Detail>
            )}
          </div>
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
            Last changed{" "}
            <time dateTime={new Date(wire.updatedAt).toISOString()} className="tabular-nums">
              {formatTimestamp(wire.updatedAt)}
            </time>{" "}
            by {wire.updatedByName}
          </p>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">No wire instructions on file.</p>
      )}

      {dialog === "edit" && (
        <WireInstructionsDialog
          saved={wire}
          companyName={company.name}
          onSave={async (values) => {
            await saveWireInstructions({ titleCompanyId: company._id, ...values });
            toast.success(wire ? "Wire instructions updated" : "Wire instructions saved");
          }}
          onClose={close}
          finalFocus={finalFocus}
        />
      )}
      <ConfirmDialog
        open={dialog === "remove"}
        title="Remove wire instructions?"
        description={`The bank details and encrypted account numbers for ${company.name} will be permanently removed.`}
        confirmLabel="Remove wire instructions"
        variant="destructive"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={close}
      />
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href={LIST_HREF}
      aria-label="Back to title companies"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </Link>
  );
}

export default function AdminTitleCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"titleCompanies">;
  const company = useQuery(api.titleCompanies.get, { id });
  const updateCompany = useMutation(api.titleCompanies.update);
  const removeCompany = useMutation(api.titleCompanies.remove);
  const { dialog, section, open, close, finalFocus } = useDialogFocus<"edit" | "delete">();
  const [deleting, setDeleting] = useState(false);

  if (company === undefined || (company === null && deleting)) {
    return <DetailPageSkeleton />;
  }

  if (company === null) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={Building2}
          title="Title company not found"
          description="It may have been deleted."
          action={
            <Link href={LIST_HREF} className={outlineButtonClassName}>
              Back to title companies
            </Link>
          }
        />
      </div>
    );
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await removeCompany({ id });
      toast.success("Title company deleted");
      router.push(LIST_HREF);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the title company."));
      setDeleting(false);
    }
  }

  const deleteParts = [
    ...(company.contacts.length > 0 ? [plural(company.contacts.length, "contact")] : []),
    ...(company.wireInstructions ? ["wire instructions"] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <BackLink />
        <PageHeader title={company.name} />
      </div>

      <section ref={section} tabIndex={-1} aria-labelledby="title-company-details-heading" className={cardClassName}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="title-company-details-heading" className={headingClassName}>
            Company details
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => open("edit", event.currentTarget)}
              className={outlineButtonClassName}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => open("delete", event.currentTarget)}
              className={destructiveButtonClassName}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Main phone">{company.phone ? <PhoneLink phone={company.phone} /> : "—"}</Detail>
          <Detail label="Main email">{company.email ? <EmailLink email={company.email} /> : "—"}</Detail>
          <Detail label="Address" wide>
            {company.address ?? "—"}
          </Detail>
          {company.notes && (
            <Detail label="Notes" wide>
              <p className="whitespace-pre-wrap font-normal">{company.notes}</p>
            </Detail>
          )}
        </div>
      </section>

      <ContactsCard company={company} />
      <WireInstructionsCard company={company} />

      {dialog === "edit" && (
        <TitleCompanyFormDialog
          company={company}
          onSave={async (values) => {
            await updateCompany({ id, ...values });
            toast.success("Title company updated");
          }}
          onClose={close}
          finalFocus={finalFocus}
        />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete ${company.name}?`}
        description={`This permanently deletes the company${
          deleteParts.length > 0 ? ` along with its ${deleteParts.join(" and ")}` : ""
        }. This can't be undone.`}
        confirmLabel="Delete title company"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={close}
      />
    </div>
  );
}
