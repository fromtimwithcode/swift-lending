import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { getCalculationGuide } from "./lib/calculationGuide";
import { getAppConfiguration } from "./lib/settings";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return getCalculationGuide(await getAppConfiguration(ctx));
  },
});
