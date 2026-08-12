"use client";

import type { ReactNode } from "react";
import { STRATEGY_LABELS } from "@/convex/lib/constants";
import {
  getPropertyDetailsError,
  getPropertyUnitCount,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  type LoanStrategy,
  type PropertyDetails,
  type PropertyType,
} from "@/convex/lib/propertyDetails";

type UnitFormValues = {
  bedrooms: string;
  bathrooms: string;
};

export type LoanPropertyFormValues = {
  strategy: "" | LoanStrategy;
  propertyType: "" | PropertyType;
  bedrooms: string;
  bathrooms: string;
  squareFeetAboveGrade: string;
  squareFeetBelowGrade: string;
  unitDetails: UnitFormValues[];
};

export function createEmptyLoanPropertyForm(): LoanPropertyFormValues {
  return {
    strategy: "",
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    squareFeetAboveGrade: "",
    squareFeetBelowGrade: "",
    unitDetails: [],
  };
}

export function createLoanPropertyFormFromLoan(loan: Partial<PropertyDetails> & {
  strategy?: LoanStrategy;
}): LoanPropertyFormValues {
  return {
    strategy: loan.strategy ?? "",
    propertyType: loan.propertyType ?? "",
    bedrooms: loan.bedrooms === undefined ? "" : String(loan.bedrooms),
    bathrooms: loan.bathrooms === undefined ? "" : String(loan.bathrooms),
    squareFeetAboveGrade:
      loan.squareFeetAboveGrade === undefined ? "" : String(loan.squareFeetAboveGrade),
    squareFeetBelowGrade:
      loan.squareFeetBelowGrade === undefined ? "" : String(loan.squareFeetBelowGrade),
    unitDetails: (loan.unitDetails ?? []).map((unit) => ({
      bedrooms: String(unit.bedrooms),
      bathrooms: String(unit.bathrooms),
    })),
  };
}

export function parseLoanPropertyForm(values: LoanPropertyFormValues) {
  if (!values.strategy) return { error: "Strategy is required" } as const;
  if (!values.propertyType) return { error: "Property type is required" } as const;

  const details: PropertyDetails = {
    propertyType: values.propertyType,
    bedrooms: Number(values.bedrooms),
    bathrooms: Number(values.bathrooms),
    squareFeetAboveGrade: Number(values.squareFeetAboveGrade),
    squareFeetBelowGrade: Number(values.squareFeetBelowGrade),
    unitDetails: values.unitDetails.map((unit, index) => ({
      unitNumber: index + 1,
      bedrooms: Number(unit.bedrooms),
      bathrooms: Number(unit.bathrooms),
    })),
  };
  const error = getPropertyDetailsError(details);
  return error
    ? ({ error } as const)
    : ({ data: { strategy: values.strategy, ...details } } as const);
}

function totalOrBlank(units: UnitFormValues[], key: keyof UnitFormValues) {
  if (units.some((unit) => !unit[key].trim())) return "";
  return String(units.reduce((sum, unit) => sum + Number(unit[key]), 0));
}

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
      {children} <span className="text-destructive">*</span>
    </label>
  );
}

export function LoanPropertyFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: LoanPropertyFormValues;
  onChange: (value: LoanPropertyFormValues) => void;
}) {
  const inputClass =
    "min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
  const unitCount = getPropertyUnitCount(value.propertyType);

  const setField = (key: keyof LoanPropertyFormValues, nextValue: string) =>
    onChange({ ...value, [key]: nextValue });

  const setPropertyType = (propertyType: "" | PropertyType) => {
    const nextUnitCount = getPropertyUnitCount(propertyType);
    const unitDetails = Array.from({ length: nextUnitCount }, (_, index) =>
      value.unitDetails[index] ?? { bedrooms: "", bathrooms: "" }
    );
    onChange({
      ...value,
      propertyType,
      unitDetails,
      bedrooms: nextUnitCount ? totalOrBlank(unitDetails, "bedrooms") : value.bedrooms,
      bathrooms: nextUnitCount ? totalOrBlank(unitDetails, "bathrooms") : value.bathrooms,
    });
  };

  const setUnitField = (
    index: number,
    key: keyof UnitFormValues,
    nextValue: string
  ) => {
    const unitDetails = value.unitDetails.map((unit, unitIndex) =>
      unitIndex === index ? { ...unit, [key]: nextValue } : unit
    );
    onChange({
      ...value,
      unitDetails,
      bedrooms: totalOrBlank(unitDetails, "bedrooms"),
      bathrooms: totalOrBlank(unitDetails, "bathrooms"),
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <RequiredLabel htmlFor={`${idPrefix}-strategy`}>Strategy</RequiredLabel>
        <select
          id={`${idPrefix}-strategy`}
          required
          value={value.strategy}
          onChange={(event) => setField("strategy", event.target.value)}
          className={inputClass}
        >
          <option value="">Select a strategy</option>
          {Object.entries(STRATEGY_LABELS).map(([strategy, label]) => (
            <option key={strategy} value={strategy}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <RequiredLabel htmlFor={`${idPrefix}-property-type`}>Property Type</RequiredLabel>
        <select
          id={`${idPrefix}-property-type`}
          required
          value={value.propertyType}
          onChange={(event) => setPropertyType(event.target.value as "" | PropertyType)}
          className={inputClass}
        >
          <option value="">Select a property type</option>
          {PROPERTY_TYPES.map((propertyType) => (
            <option key={propertyType} value={propertyType}>
              {PROPERTY_TYPE_LABELS[propertyType]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <RequiredLabel htmlFor={`${idPrefix}-square-feet-above-grade`}>
          Square Feet Above Grade
        </RequiredLabel>
        <input
          id={`${idPrefix}-square-feet-above-grade`}
          required
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.squareFeetAboveGrade}
          onChange={(event) => setField("squareFeetAboveGrade", event.target.value)}
          placeholder="0"
          className={inputClass}
        />
      </div>

      <div>
        <RequiredLabel htmlFor={`${idPrefix}-square-feet-below-grade`}>
          Square Feet Below Grade
        </RequiredLabel>
        <input
          id={`${idPrefix}-square-feet-below-grade`}
          required
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.squareFeetBelowGrade}
          onChange={(event) => setField("squareFeetBelowGrade", event.target.value)}
          placeholder="0 if none"
          className={inputClass}
        />
      </div>

      <div>
        <RequiredLabel htmlFor={`${idPrefix}-bedrooms`}>Bedrooms</RequiredLabel>
        <input
          id={`${idPrefix}-bedrooms`}
          required
          readOnly={unitCount > 0}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.bedrooms}
          onChange={(event) => setField("bedrooms", event.target.value)}
          placeholder={unitCount ? "Calculated from units" : "0"}
          className={`${inputClass} ${unitCount ? "bg-muted/40" : ""}`}
        />
      </div>

      <div>
        <RequiredLabel htmlFor={`${idPrefix}-bathrooms`}>Bathrooms</RequiredLabel>
        <input
          id={`${idPrefix}-bathrooms`}
          required
          readOnly={unitCount > 0}
          inputMode="decimal"
          value={value.bathrooms}
          onChange={(event) => setField("bathrooms", event.target.value)}
          placeholder={unitCount ? "Calculated from units" : "0"}
          className={`${inputClass} ${unitCount ? "bg-muted/40" : ""}`}
        />
        {!unitCount && (
          <p className="mt-1 text-xs text-muted-foreground">Use whole or half values, such as 1.5.</p>
        )}
      </div>

      {unitCount > 0 && (
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium">
            Unit Breakdown <span className="text-destructive">*</span>
          </legend>
          <p className="text-xs text-muted-foreground">
            Bedroom and bathroom totals are calculated from these units.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {value.unitDetails.map((unit, index) => (
              <div key={index} className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="mb-3 text-sm font-semibold">Unit {index + 1}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <RequiredLabel htmlFor={`${idPrefix}-unit-${index + 1}-bedrooms`}>
                      Bedrooms
                    </RequiredLabel>
                    <input
                      id={`${idPrefix}-unit-${index + 1}-bedrooms`}
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={unit.bedrooms}
                      onChange={(event) => setUnitField(index, "bedrooms", event.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <RequiredLabel htmlFor={`${idPrefix}-unit-${index + 1}-bathrooms`}>
                      Bathrooms
                    </RequiredLabel>
                    <input
                      id={`${idPrefix}-unit-${index + 1}-bathrooms`}
                      required
                      inputMode="decimal"
                      value={unit.bathrooms}
                      onChange={(event) => setUnitField(index, "bathrooms", event.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
