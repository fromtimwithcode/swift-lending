import { v } from "convex/values";

export const propertyTypeValidator = v.union(
  v.literal("single_family"),
  v.literal("duplex"),
  v.literal("four_family")
);

export const propertyUnitDetailsValidator = v.array(
  v.object({
    unitNumber: v.number(),
    bedrooms: v.number(),
    bathrooms: v.number(),
  })
);
