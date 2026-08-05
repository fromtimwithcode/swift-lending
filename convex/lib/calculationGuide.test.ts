import { describe, expect, test } from "vitest";
import { DEFAULT_APP_CONFIGURATION } from "./appConfiguration";
import { getCalculationGuide } from "./calculationGuide";

describe("calculation guide", () => {
  test("describes configured comparable location weights", () => {
    const configuration = {
      ...DEFAULT_APP_CONFIGURATION,
      comparables: {
        ...DEFAULT_APP_CONFIGURATION.comparables,
        sameState: 11,
        sameCity: 17,
      },
    };
    const guide = getCalculationGuide(configuration);
    const locationRule = guide.sections
      .find((section) => section.id === "comps")
      ?.rules.find((rule) => rule.name === "Location");

    expect(locationRule?.detail).toBe(
      "A matching city and state contributes up to 28 points."
    );
  });
});
