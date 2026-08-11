"use client";

/* eslint-disable @next/next/no-img-element -- Local object URLs are used for pre-submit upload previews. */

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2, Upload, X, ImageIcon, Info, FileText } from "lucide-react";
import { calculateMonthlyPayment, calculatePoints } from "@/lib/loan-calc";
import { DEFAULT_INTEREST_RATE, DEFAULT_POINTS_PERCENTAGE, MAX_FILE_SIZE_BYTES } from "@/convex/lib/constants";
import { formatCurrency, formatFileSize } from "@/lib/format";
import { AddressInput } from "@/components/dashboard/address-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import {
  createEmptyLoanPropertyForm,
  LoanPropertyFields,
  parseLoanPropertyForm,
} from "@/components/dashboard/loan-property-fields";

interface UploadedPhoto {
  storageId: Id<"_storage">;
  fileName: string;
  previewUrl: string;
}

type EntityDocumentType = "articles" | "operating_agreement";

interface UploadedEntityDocument {
  storageId: Id<"_storage">;
  fileName: string;
  fileSize: number;
  type: EntityDocumentType;
}

export default function LoanApplicationPage() {
  const router = useRouter();
  const submitApplication = useMutation(api.borrower.submitApplication);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const loanDefaults = useQuery(api.settings.getLoanDefaults);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entityName: "",
    propertyAddress: "",
    purchasePrice: "",
    afterRepairValue: "",
    rehabBudgetTotal: "",
    loanAmount: "",
    terms: "12 months",
    notes: "",
    titleCompanyName: "",
    titleCompanyContact: "",
    titleCompanyContactEmail: "",
    titleCompanyContactPhone: "",
    isUnderContract: "" as "" | "yes" | "no",
    acquisitionType: "" as "" | "wholesaler" | "direct_to_seller",
    desiredCloseDate: "",
  });
  const [propertyDetails, setPropertyDetails] = useState(createEmptyLoanPropertyForm);
  const [loanAmountEdited, setLoanAmountEdited] = useState(false);

  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadedEntityDocuments, setUploadedEntityDocuments] = useState<UploadedEntityDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entityDocumentInputRefs = useRef<Record<EntityDocumentType, HTMLInputElement | null>>({
    articles: null,
    operating_agreement: null,
  });
  const purchasePrice = Number(form.purchasePrice) || 0;
  const rehabBudgetTotal = Number(form.rehabBudgetTotal) || 0;
  const defaultLoanAmount = purchasePrice + rehabBudgetTotal;
  const totalLoanAmount = Number(form.loanAmount) || 0;
  const defaultInterestRate = loanDefaults?.defaultInterestRate ?? DEFAULT_INTEREST_RATE;
  const defaultPointsPercentage =
    loanDefaults?.defaultPointsPercentage ?? DEFAULT_POINTS_PERCENTAGE;

  useEffect(() => {
    if (loanAmountEdited) return;

    const nextLoanAmount = defaultLoanAmount ? String(defaultLoanAmount) : "";
    setForm((prev) => (
      prev.loanAmount === nextLoanAmount ? prev : { ...prev, loanAmount: nextLoanAmount }
    ));
  }, [defaultLoanAmount, loanAmountEdited]);

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

  const field = (key: string, opts?: { type?: string; placeholder?: string }) => ({
    value: form[key as keyof typeof form],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      update(key, e.target.value),
    type: opts?.type,
    placeholder: opts?.placeholder,
    className:
      "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
  });

  const toggleBtnClass = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-background text-foreground hover:bg-muted"
    }`;

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxPhotos = 50;
    if (uploadedPhotos.length + files.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const validFiles = Array.from(files).filter((f) => {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File "${f.name}" is too large (${formatFileSize(f.size)}). Max ${formatFileSize(MAX_FILE_SIZE_BYTES)}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      for (const file of validFiles) {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed: " + result.statusText);
        const { storageId } = await result.json();

        setUploadedPhotos((prev) => [
          ...prev,
          {
            storageId,
            fileName: file.name,
            previewUrl: URL.createObjectURL(file),
          },
        ]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Photo upload failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEntityDocumentUpload = async (
    files: FileList | null,
    type: EntityDocumentType
  ) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((f) => {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File "${f.name}" is too large (${formatFileSize(f.size)}). Max ${formatFileSize(MAX_FILE_SIZE_BYTES)}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      for (const file of validFiles) {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed: " + result.statusText);
        const { storageId } = await result.json();

        setUploadedEntityDocuments((prev) => [
          ...prev,
          {
            storageId,
            fileName: file.name,
            fileSize: file.size,
            type,
          },
        ]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Document upload failed"));
    } finally {
      setUploading(false);
      const input = entityDocumentInputRefs.current[type];
      if (input) input.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeEntityDocument = (index: number) => {
    setUploadedEntityDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.entityName ||
      !form.propertyAddress ||
      !form.purchasePrice ||
      !form.afterRepairValue
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (totalLoanAmount <= 0) {
      toast.error("Total loan amount must be greater than 0");
      return;
    }
    if (purchasePrice < 0) {
      toast.error("Purchase price cannot be negative");
      return;
    }
    if (rehabBudgetTotal < 0) {
      toast.error("Rehab budget cannot be negative");
      return;
    }
    if (uploadedPhotos.length === 0) {
      toast.error("At least one property photo is required");
      return;
    }
    const parsedPropertyDetails = parseLoanPropertyForm(propertyDetails);
    if ("error" in parsedPropertyDetails) {
      toast.error(parsedPropertyDetails.error);
      return;
    }
    if (!form.desiredCloseDate) {
      toast.error("Close date is required");
      return;
    }
    if (!form.titleCompanyName.trim()) {
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

    setSaving(true);
    try {
      const loanId = await submitApplication({
        entityName: form.entityName,
        propertyAddress: form.propertyAddress,
        purchasePrice,
        loanAmount: totalLoanAmount,
        afterRepairValue: Number(form.afterRepairValue),
        rehabBudgetTotal: rehabBudgetTotal || undefined,
        terms: form.terms,
        notes: form.notes || undefined,
        titleCompanyName: form.titleCompanyName,
        titleCompanyContact: form.titleCompanyContact,
        titleCompanyContactEmail: form.titleCompanyContactEmail,
        titleCompanyContactPhone: form.titleCompanyContactPhone,
        isUnderContract: form.isUnderContract === "yes" ? true : form.isUnderContract === "no" ? false : undefined,
        acquisitionType:
          form.isUnderContract === "yes" && form.acquisitionType
            ? (form.acquisitionType as "wholesaler" | "direct_to_seller")
            : undefined,
        desiredCloseDate: form.desiredCloseDate,
        ...parsedPropertyDetails.data,
        photoFileIds: uploadedPhotos.map((p) => ({
          storageId: p.storageId,
          fileName: p.fileName,
        })),
        entityDocumentFileIds: uploadedEntityDocuments.map((doc) => ({
          storageId: doc.storageId,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          type: doc.type,
        })),
      });
      router.push(`/dashboard/borrower/loans/${loanId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit application"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href="/dashboard/borrower"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="Apply for a Loan"
          description="Submit a new loan application"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entity Info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Entity Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Entity / LLC Name <span className="text-red-500">*</span>
              </label>
              <input {...field("entityName", { placeholder: "e.g. My LLC" })} />
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-3">
                <p className="text-sm font-medium">LLC Documents</p>
                <p className="text-xs text-muted-foreground">
                  Upload Articles of Organization or Operating Agreement files with this application.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["articles", "Articles of Organization"],
                  ["operating_agreement", "Operating Agreement / OA"],
                ] as const).map(([type, label]) => (
                  <div key={type}>
                    <input
                      ref={(el) => {
                        entityDocumentInputRefs.current[type] = el;
                      }}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                      multiple
                      onChange={(e) => handleEntityDocumentUpload(e.target.files, type)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => entityDocumentInputRefs.current[type]?.click()}
                      disabled={uploading}
                      className="flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-center text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted disabled:opacity-50 active:scale-[0.96]"
                    >
                      {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
                      <span>{label}</span>
                    </button>
                  </div>
                ))}
              </div>

              {uploadedEntityDocuments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedEntityDocuments.map((doc, index) => (
                    <div
                      key={`${doc.storageId}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.type === "articles" ? "Articles of Organization" : "Operating Agreement"} · {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEntityDocument(index)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.96]"
                        aria-label={`Remove ${doc.fileName}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Property Details
          </h3>
          <LoanPropertyFields
            idPrefix="loan-application-property"
            value={propertyDetails}
            onChange={setPropertyDetails}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                Property Address <span className="text-red-500">*</span>
              </label>
              <AddressInput
                {...field("propertyAddress", {
                  placeholder: "123 Main St, City, State ZIP",
                })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Purchase Price <span className="text-red-500">*</span>
              </label>
              <input
                {...field("purchasePrice", { type: "number", placeholder: "0" })}
              />
            </div>
            <div>
              <label
                htmlFor="application-after-repair-value"
                className="mb-1.5 block text-sm font-medium"
              >
                After Repair Value (ARV) <span className="text-destructive">*</span>
              </label>
              <input
                id="application-after-repair-value"
                required
                {...field("afterRepairValue", { type: "number", placeholder: "0" })}
              />
            </div>
          </div>
        </div>

        {/* Loan Request */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Loan Request
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Rehab Budget
              </label>
              <input
                {...field("rehabBudgetTotal", { type: "number", placeholder: "0" })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Requested Loan Amount
              </label>
              <input
                value={form.loanAmount}
                onChange={(e) => handleLoanAmountChange(e.target.value)}
                type="number"
                placeholder="0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Defaults to purchase + rehab. Adjust if you will bring cash to close.</span>
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
              <label className="mb-1.5 block text-sm font-medium">
                Desired Terms
              </label>
              <select {...field("terms")}>
                <option value="6 months">6 months</option>
                <option value="9 months">9 months</option>
                <option value="12 months">12 months</option>
                <option value="18 months">18 months</option>
                <option value="24 months">24 months</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estimated Loan Terms */}
        {totalLoanAmount > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="mb-3 flex items-center gap-2">
              <Info className="size-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Estimated Loan Terms
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Interest Rate</p>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {defaultInterestRate}%
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Est. Monthly Payment</p>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {formatCurrency(
                    calculateMonthlyPayment(totalLoanAmount, defaultInterestRate)
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Est. Origination Points ({defaultPointsPercentage}%)</p>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  {formatCurrency(
                    calculatePoints(totalLoanAmount, defaultPointsPercentage)
                  )}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
              These are estimates only. Actual terms are subject to approval.
            </p>
          </div>
        )}

        {/* Title & Contract Info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Title & Contract Info
          </h3>
          <div className="space-y-4">
            <div className="grid gap-4 rounded-xl border border-border bg-muted/25 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="application-title-company" className="mb-1.5 block text-sm font-medium">
                  Title Company <span className="text-destructive">*</span>
                </label>
                <input
                  id="application-title-company"
                  required
                  autoComplete="organization"
                  {...field("titleCompanyName", { placeholder: "Title company name" })}
                />
              </div>
              <div>
                <label htmlFor="application-title-contact" className="mb-1.5 block text-sm font-medium">
                  Title Contact <span className="text-destructive">*</span>
                </label>
                <input
                  id="application-title-contact"
                  required
                  autoComplete="name"
                  {...field("titleCompanyContact", { placeholder: "Contact name" })}
                />
              </div>
              <div>
                <label htmlFor="application-title-contact-email" className="mb-1.5 block text-sm font-medium">
                  Contact Email <span className="text-destructive">*</span>
                </label>
                <input
                  id="application-title-contact-email"
                  required
                  autoComplete="email"
                  {...field("titleCompanyContactEmail", { type: "email", placeholder: "name@example.com" })}
                />
              </div>
              <div>
                <label htmlFor="application-title-contact-phone" className="mb-1.5 block text-sm font-medium">
                  Contact Phone <span className="text-destructive">*</span>
                </label>
                <input
                  id="application-title-contact-phone"
                  required
                  autoComplete="tel"
                  {...field("titleCompanyContactPhone", { type: "tel", placeholder: "(555) 555-5555" })}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Do you currently have this under contract?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      isUnderContract: prev.isUnderContract === "yes" ? "" : "yes",
                      acquisitionType: prev.isUnderContract === "yes" ? "" : prev.acquisitionType,
                    }))
                  }
                  className={toggleBtnClass(form.isUnderContract === "yes")}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      isUnderContract: prev.isUnderContract === "no" ? "" : "no",
                      acquisitionType: "",
                    }))
                  }
                  className={toggleBtnClass(form.isUnderContract === "no")}
                >
                  No
                </button>
              </div>
            </div>

            {form.isUnderContract === "yes" && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Acquisition type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => update("acquisitionType", "wholesaler")}
                    className={toggleBtnClass(form.acquisitionType === "wholesaler")}
                  >
                    Wholesaler
                  </button>
                  <button
                    type="button"
                    onClick={() => update("acquisitionType", "direct_to_seller")}
                    className={toggleBtnClass(form.acquisitionType === "direct_to_seller")}
                  >
                    Direct to Seller
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Close Date <span className="text-destructive">*</span>
              </label>
              <DatePickerField
                value={form.desiredCloseDate}
                onChange={(value) => update("desiredCloseDate", value)}
                placeholder="Select desired close date"
                ariaLabel="Desired Close Date"
                required
              />
            </div>
          </div>
        </div>

        {/* Property Photos */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Property Photos <span className="text-red-500">*</span>
          </h3>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex min-h-28 w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-8 animate-spin" />
              ) : (
                <Upload className="size-8" />
              )}
              <p className="text-sm font-medium">
                {uploading ? "Uploading..." : "Click to upload property photos"}
              </p>
              <p className="text-xs">PNG, JPG, JPEG, or WebP (max {formatFileSize(MAX_FILE_SIZE_BYTES)} each)</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              multiple
              onChange={(e) => handlePhotoUpload(e.target.files)}
              className="hidden"
            />

            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {uploadedPhotos.map((photo, index) => (
                  <div
                    key={photo.storageId}
                    className="group relative overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={photo.previewUrl}
                      alt={photo.fileName}
                      className="image-outline aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="truncate text-xs text-white">{photo.fileName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadedPhotos.length === 0 && !uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon className="size-4" />
                <span>At least 1 photo required to submit</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Additional Notes
          </h3>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            placeholder="Anything else you'd like us to know..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/dashboard/borrower"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Submit Application
          </button>
        </div>
      </form>
    </div>
  );
}
