"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Banknote,
  BellRing,
  History,
  Loader2,
  RotateCcw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AppConfiguration } from "@/convex/lib/appConfiguration";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import {
  SystemImpactAlertDialog,
  type ConfigurationImpactPreview,
} from "./system-impact-alert-dialog";

type ConfigurationField =
  | `loanDefaults.${keyof AppConfiguration["loanDefaults"]}`
  | `operations.${keyof AppConfiguration["operations"]}`
  | `comparables.${keyof AppConfiguration["comparables"]}`;

interface FieldDefinition {
  key: ConfigurationField;
  label: string;
  description: string;
  min: number;
  max: number;
  integer?: boolean;
  suffix?: string;
}

const FIELD_GROUPS: Array<{
  id: string;
  title: string;
  description: string;
  icon: typeof Banknote;
  fields: FieldDefinition[];
}> = [
  {
    id: "loan-defaults",
    title: "Loan defaults",
    description: "Applied when a new application or loan record is created.",
    icon: Banknote,
    fields: [
      { key: "loanDefaults.annualInterestRate", label: "Annual interest rate", description: "Default rate for new loans and estimates.", min: 0, max: 100, suffix: "%" },
      { key: "loanDefaults.originationPointsPercentage", label: "Origination points", description: "Percentage of total loan amount charged at origination.", min: 0, max: 100, suffix: "%" },
      { key: "loanDefaults.paymentDueDay", label: "Payment due day", description: "Calendar day used for new monthly-payment loans.", min: 1, max: 31, integer: true },
      { key: "loanDefaults.loanTermMonths", label: "Standard term", description: "Suggested maturity term for newly created loans.", min: 1, max: 120, integer: true, suffix: "months" },
    ],
  },
  {
    id: "operations",
    title: "Payment operations",
    description: "Takes effect immediately for scheduled work and reminders.",
    icon: BellRing,
    fields: [
      { key: "operations.interestChargeWindowDays", label: "Charge preparation window", description: "How early upcoming monthly charges are prepared.", min: 0, max: 90, integer: true, suffix: "days" },
      { key: "operations.paymentReminderWindowDays", label: "Payment reminder window", description: "How early open payment balances enter reminders.", min: 0, max: 90, integer: true, suffix: "days" },
    ],
  },
  {
    id: "comparables",
    title: "Comparable ranking",
    description: "Controls how internal loans are ranked as property comparables.",
    icon: Scale,
    fields: [
      { key: "comparables.maxResults", label: "Maximum results", description: "Number of highest-ranked comparable loans shown.", min: 1, max: 25, integer: true },
      { key: "comparables.sameState", label: "Same-state weight", description: "Points awarded for a matching state.", min: 0, max: 100 },
      { key: "comparables.sameCity", label: "Same-city weight", description: "Points awarded for a matching city.", min: 0, max: 100 },
      { key: "comparables.purchasePrice", label: "Purchase-price weight", description: "Maximum points for purchase-price similarity.", min: 0, max: 100 },
      { key: "comparables.afterRepairValue", label: "ARV weight", description: "Maximum points for after-repair-value similarity.", min: 0, max: 100 },
      { key: "comparables.rehabBudget", label: "Rehab-budget weight", description: "Maximum points for rehab-budget similarity.", min: 0, max: 100 },
      { key: "comparables.statusClosed", label: "Closed status", description: "Points awarded to closed comparable loans.", min: 0, max: 100 },
      { key: "comparables.statusFunded", label: "Funded status", description: "Points awarded to funded comparable loans.", min: 0, max: 100 },
      { key: "comparables.statusSentToTitle", label: "Sent-to-title status", description: "Points awarded to loans sent to title.", min: 0, max: 100 },
      { key: "comparables.recencyMax", label: "Maximum recency weight", description: "Starting score contribution for the newest loans.", min: 0, max: 100 },
      { key: "comparables.recencyPointsLostPerMonth", label: "Monthly recency reduction", description: "Points removed for each 30-day month of age.", min: 0, max: 25 },
      { key: "comparables.similarityPenaltyMultiplier", label: "Similarity penalty", description: "How quickly value-similarity points fall with percentage difference.", min: 0, max: 25, suffix: "×" },
      { key: "comparables.maxScore", label: "Maximum score", description: "Upper cap applied after all ranking points are added.", min: 1, max: 1000, integer: true },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);
type Draft = Record<ConfigurationField, string>;

function readConfigurationValue(
  configuration: AppConfiguration,
  path: ConfigurationField
) {
  const [group, field] = path.split(".") as [keyof AppConfiguration, string];
  return (configuration[group] as unknown as Record<string, number>)[field];
}

function writeConfigurationValue(
  configuration: AppConfiguration,
  path: ConfigurationField,
  value: number
) {
  const [group, field] = path.split(".") as [keyof AppConfiguration, string];
  (configuration[group] as unknown as Record<string, number>)[field] = value;
}

function makeDraft(configuration: AppConfiguration) {
  return Object.fromEntries(
    ALL_FIELDS.map((field) => [field.key, String(readConfigurationValue(configuration, field.key))])
  ) as Draft;
}

function cloneConfiguration(configuration: AppConfiguration): AppConfiguration {
  return {
    loanDefaults: { ...configuration.loanDefaults },
    operations: { ...configuration.operations },
    comparables: { ...configuration.comparables },
  };
}

function formatUpdatedAt(timestamp: number | null) {
  if (!timestamp) return "Using deployment defaults";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function AppConfigurationEditor() {
  const settings = useQuery(api.settings.getAdminSettings);
  const history = useQuery(api.settings.getConfigurationHistory);
  const updateConfiguration = useMutation(api.settings.updateAppConfiguration);
  const retryComparableRebuild = useMutation(api.comps.retryComparableRebuild);
  const [editor, setEditor] = useState<{
    draft: Draft;
    baseConfiguration: AppConfiguration;
    baseVersion: number;
  } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ConfigurationField, string>>>({});
  const [proposed, setProposed] = useState<AppConfiguration | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryingRebuild, setRetryingRebuild] = useState(false);

  const preview = useQuery(
    api.settings.previewConfigurationChange,
    proposed ? { configuration: proposed } : "skip"
  ) as ConfigurationImpactPreview | undefined;

  const dirty = useMemo(() => {
    if (!editor) return false;
    return JSON.stringify(editor.draft) !== JSON.stringify(makeDraft(editor.baseConfiguration));
  }, [editor]);
  const stale = Boolean(
    settings && editor && settings.version > editor.baseVersion
  );

  useEffect(() => {
    if (!settings) return;
    setEditor((current) => {
      if (current && (dirty || current.baseVersion >= settings.version)) return current;
      return {
        draft: makeDraft(settings.configuration),
        baseConfiguration: cloneConfiguration(settings.configuration),
        baseVersion: settings.version,
      };
    });
  }, [settings, dirty]);

  if (!settings || !editor) {
    return (
      <div className="space-y-4 rounded-2xl bg-card p-6 shadow-sm" aria-label="Loading app configuration">
        <div className="h-6 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  const resetTo = (configuration: AppConfiguration, version: number) => {
    setEditor({
      draft: makeDraft(configuration),
      baseConfiguration: cloneConfiguration(configuration),
      baseVersion: version,
    });
    setErrors({});
    setSubmitError(null);
  };

  const parseDraft = () => {
    const nextErrors: Partial<Record<ConfigurationField, string>> = {};
    const configuration = cloneConfiguration(editor.baseConfiguration);
    for (const field of ALL_FIELDS) {
      const value = Number(editor.draft[field.key]);
      if (!editor.draft[field.key].trim() || !Number.isFinite(value)) {
        nextErrors[field.key] = "Enter a valid number";
      } else if (value < field.min || value > field.max) {
        nextErrors[field.key] = `Enter a value from ${field.min} to ${field.max}`;
      } else if (field.integer && !Number.isInteger(value)) {
        nextErrors[field.key] = "Enter a whole number";
      } else {
        writeConfigurationValue(configuration, field.key, value);
      }
    }
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as ConfigurationField | undefined;
    if (firstError) {
      document.getElementById(`configuration-${firstError.replace(".", "-")}`)?.focus();
      return null;
    }
    return configuration;
  };

  const reviewChanges = () => {
    if (stale) return;
    const configuration = parseDraft();
    if (!configuration) return;
    setSubmitError(null);
    setProposed(configuration);
    setReviewOpen(true);
  };

  const applyChanges = async (reason?: string) => {
    if (!proposed) return;
    setApplying(true);
    setSubmitError(null);
    try {
      const result = await updateConfiguration({
        configuration: proposed,
        expectedVersion: editor.baseVersion,
        reason,
      });
      resetTo(result.configuration, result.version);
      setReviewOpen(false);
      setProposed(null);
      toast.success(`App configuration v${result.version} published`);
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, "Could not publish the app configuration")
      );
    } finally {
      setApplying(false);
    }
  };

  const retryRebuild = async () => {
    setRetryingRebuild(true);
    try {
      await retryComparableRebuild({});
      toast.success("Comparable rebuild queued");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not retry the comparable rebuild"));
    } finally {
      setRetryingRebuild(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="app-configuration-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="app-configuration-heading" className="text-balance text-lg font-semibold">
            App configuration
          </h2>
          <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">
            One governed source for new-loan policy, payment operations, and comparable ranking.
          </p>
        </div>
        <div className="text-xs text-muted-foreground sm:text-right">
          <p className="font-medium text-foreground tabular-nums">Version {settings.version}</p>
          <p>{formatUpdatedAt(settings.updatedAt)}{settings.updatedByName ? ` by ${settings.updatedByName}` : ""}</p>
        </div>
      </div>

      {stale && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>Another admin published a newer configuration. Reload it before continuing.</p>
          <button
            type="button"
            onClick={() => resetTo(settings.configuration, settings.version)}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 font-medium hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Load latest
          </button>
        </div>
      )}

      {settings.comparableRebuild?.status === "failed" && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Comparable ranking update failed.</p>
            <p className="mt-1 text-pretty text-muted-foreground">
              {settings.comparableRebuild.error ?? "The rebuild stopped before all loans were reviewed."}
            </p>
          </div>
          <button
            type="button"
            onClick={retryRebuild}
            disabled={retryingRebuild}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 font-medium hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {retryingRebuild ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-4" aria-hidden="true" />
            )}
            Retry rebuild
          </button>
        </div>
      )}

      {settings.comparableRebuild && ["queued", "running"].includes(settings.comparableRebuild.status) && (
        <div className="flex items-center gap-3 rounded-xl bg-primary/8 px-4 py-3 text-sm">
          <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-pretty">
            Comparable rankings are updating to version {settings.comparableRebuild.configurationVersion}.
            <span className="ml-1 text-muted-foreground tabular-nums">
              {settings.comparableRebuild.processedLoans} loan records reviewed.
            </span>
            <span className="ml-1 text-muted-foreground">
              Stored rankings remain visible until each loan is refreshed.
            </span>
          </p>
        </div>
      )}

      {FIELD_GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <fieldset key={group.id} className="rounded-2xl bg-card p-5 shadow-sm sm:p-6">
            <legend className="sr-only">{group.title}</legend>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">{group.title}</h3>
                <p className="mt-1 text-pretty text-sm text-muted-foreground">{group.description}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((field) => {
                const inputId = `configuration-${field.key.replace(".", "-")}`;
                const errorId = `${inputId}-error`;
                const hintId = `${inputId}-hint`;
                const error = errors[field.key];
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label htmlFor={inputId} className="text-sm font-medium">{field.label}</label>
                    <div className="relative">
                      <input
                        id={inputId}
                        type="text"
                        inputMode={field.integer ? "numeric" : "decimal"}
                        autoComplete="off"
                        value={editor.draft[field.key]}
                        onChange={(event) => {
                          const value = event.target.value;
                          setEditor((current) => current ? { ...current, draft: { ...current.draft, [field.key]: value } } : current);
                          if (errors[field.key]) setErrors((current) => ({ ...current, [field.key]: undefined }));
                        }}
                        aria-invalid={error ? "true" : undefined}
                        aria-describedby={error ? errorId : hintId}
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-14 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                      />
                      {field.suffix && (
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                          {field.suffix}
                        </span>
                      )}
                    </div>
                    {error ? (
                      <p id={errorId} className="text-xs text-destructive">{error}</p>
                    ) : (
                      <p id={hintId} className="text-pretty text-xs leading-5 text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div className="rounded-2xl bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold">Locked accounting controls</h3>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Cents rounding, payment matching tolerance, the 30/360 payoff convention,
              and posted financial history require a controlled code release to change.
            </p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-1 text-xs text-muted-foreground">
          {dirty ? "Unpublished changes" : "Configuration is up to date"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => resetTo(editor.baseConfiguration, editor.baseVersion)}
            disabled={!dirty || applying}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:flex-none"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={reviewChanges}
            disabled={!dirty || stale || applying}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,opacity,scale] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:flex-none"
          >
            Review changes
          </button>
        </div>
      </div>

      <details className="rounded-2xl bg-card p-5 shadow-sm sm:p-6">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <History className="size-4" aria-hidden="true" />
          Configuration history
        </summary>
        <div className="mt-4 space-y-3">
          {history === undefined ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No configuration changes have been published yet.</p>
          ) : (
            history.map((entry) => (
              <div key={entry._id} className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium tabular-nums">Version {entry.version}</p>
                  <p className="text-xs text-muted-foreground">{entry.changedKeys.length} setting{entry.changedKeys.length === 1 ? "" : "s"} changed by {entry.changedByName}</p>
                  {entry.reason && <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>}
                </div>
                <time className="text-xs text-muted-foreground tabular-nums" dateTime={new Date(entry.changedAt).toISOString()}>
                  {formatUpdatedAt(entry.changedAt)}
                </time>
              </div>
            ))
          )}
        </div>
      </details>

      <SystemImpactAlertDialog
        key={editor.baseVersion}
        open={reviewOpen}
        preview={preview}
        loadingPreview={reviewOpen && preview === undefined}
        applying={applying}
        error={submitError}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) {
            setProposed(null);
            setSubmitError(null);
          }
        }}
        onApply={applyChanges}
      />
    </section>
  );
}
