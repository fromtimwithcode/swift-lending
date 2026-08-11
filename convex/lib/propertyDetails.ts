export const PROPERTY_TYPES = ["single_family", "duplex", "four_family"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type LoanStrategy = "flip_and_resell" | "brrrr";

export type PropertyUnitDetails = {
  unitNumber: number;
  bedrooms: number;
  bathrooms: number;
};

export type PropertyDetails = {
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  squareFeetAboveGrade: number;
  squareFeetBelowGrade: number;
  unitDetails: PropertyUnitDetails[];
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: "Single family",
  duplex: "Duplex",
  four_family: "Four-family",
};

export function getPropertyUnitCount(propertyType: PropertyType | "" | undefined) {
  if (propertyType === "duplex") return 2;
  if (propertyType === "four_family") return 4;
  return 0;
}

export function getPropertyDetailsError(details: Partial<PropertyDetails>) {
  if (!details.propertyType) return "Property type is required";
  if (!Number.isInteger(details.bedrooms) || (details.bedrooms ?? 0) <= 0) {
    return "Bedrooms must be a whole number greater than 0";
  }
  if (
    !Number.isFinite(details.bathrooms) ||
    (details.bathrooms ?? 0) <= 0 ||
    !Number.isInteger((details.bathrooms ?? 0) * 2)
  ) {
    return "Bathrooms must be greater than 0 and use whole or half values";
  }
  if (
    !Number.isInteger(details.squareFeetAboveGrade) ||
    (details.squareFeetAboveGrade ?? 0) <= 0
  ) {
    return "Square footage above grade must be a whole number greater than 0";
  }
  if (
    !Number.isInteger(details.squareFeetBelowGrade) ||
    (details.squareFeetBelowGrade ?? -1) < 0
  ) {
    return "Square footage below grade must be a whole number of 0 or more";
  }

  const expectedUnitCount = getPropertyUnitCount(details.propertyType);
  const units = details.unitDetails ?? [];
  if (units.length !== expectedUnitCount) {
    return expectedUnitCount === 0
      ? "Single-family properties cannot include unit details"
      : `${PROPERTY_TYPE_LABELS[details.propertyType]} properties require ${expectedUnitCount} unit details`;
  }

  for (const [index, unit] of units.entries()) {
    if (unit.unitNumber !== index + 1) return "Unit numbers must be sequential";
    if (!Number.isInteger(unit.bedrooms) || unit.bedrooms <= 0) {
      return `Unit ${unit.unitNumber} bedrooms must be a whole number greater than 0`;
    }
    if (
      !Number.isFinite(unit.bathrooms) ||
      unit.bathrooms <= 0 ||
      !Number.isInteger(unit.bathrooms * 2)
    ) {
      return `Unit ${unit.unitNumber} bathrooms must be greater than 0 and use whole or half values`;
    }
  }

  if (expectedUnitCount > 0) {
    const unitBedrooms = units.reduce((sum, unit) => sum + unit.bedrooms, 0);
    const unitBathrooms = units.reduce((sum, unit) => sum + unit.bathrooms, 0);
    if (unitBedrooms !== details.bedrooms || unitBathrooms !== details.bathrooms) {
      return "Bedroom and bathroom totals must match the unit breakdown";
    }
  }

  return undefined;
}
