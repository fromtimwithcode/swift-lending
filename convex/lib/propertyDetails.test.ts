import { describe, expect, it } from "vitest";
import { getPropertyDetailsError, type PropertyDetails } from "./propertyDetails";

const singleFamily: PropertyDetails = {
  propertyType: "single_family",
  bedrooms: 3,
  bathrooms: 2.5,
  squareFeetAboveGrade: 1_600,
  squareFeetBelowGrade: 0,
  unitDetails: [],
};

describe("getPropertyDetailsError", () => {
  it("accepts a complete single-family property", () => {
    expect(getPropertyDetailsError(singleFamily)).toBeUndefined();
  });

  it("accepts a duplex when totals match both units", () => {
    expect(getPropertyDetailsError({
      ...singleFamily,
      propertyType: "duplex",
      bedrooms: 5,
      bathrooms: 3,
      unitDetails: [
        { unitNumber: 1, bedrooms: 3, bathrooms: 2 },
        { unitNumber: 2, bedrooms: 2, bathrooms: 1 },
      ],
    })).toBeUndefined();
  });

  it("requires the exact unit count for multifamily properties", () => {
    expect(getPropertyDetailsError({
      ...singleFamily,
      propertyType: "four_family",
      unitDetails: [
        { unitNumber: 1, bedrooms: 1, bathrooms: 1 },
        { unitNumber: 2, bedrooms: 1, bathrooms: 1 },
      ],
    })).toBe("Four-family properties require 4 unit details");
  });

  it("rejects totals that do not match the unit breakdown", () => {
    expect(getPropertyDetailsError({
      ...singleFamily,
      propertyType: "duplex",
      unitDetails: [
        { unitNumber: 1, bedrooms: 2, bathrooms: 1 },
        { unitNumber: 2, bedrooms: 2, bathrooms: 1 },
      ],
    })).toBe("Bedroom and bathroom totals must match the unit breakdown");
  });
});
