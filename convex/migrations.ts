import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * One-time migration: backfill authUserId on existing userProfiles
 * and strip the old tokenIdentifier field.
 *
 * Run from the Convex dashboard after deploy:
 *   internal.migrations.migrateTokenIdentifierToAuthUserId
 *
 * Safe to run multiple times (skips already-migrated profiles).
 * After confirming all profiles are migrated, remove `tokenIdentifier`
 * from the schema and redeploy (narrow step).
 */
export const migrateTokenIdentifierToAuthUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").collect();

    let migrated = 0;
    let skipped = 0;
    let noMatch = 0;
    let stripped = 0;

    // Load all auth users once and build email→id lookup
    const authUsers = await ctx.db.query("users").collect();
    const emailToAuthUserId = new Map<string, Id<"users">>();
    for (const authUser of authUsers) {
      if (authUser.email) {
        emailToAuthUserId.set(authUser.email.toLowerCase(), authUser._id);
      }
    }

    for (const profile of profiles) {
      const hasTokenIdentifier = profile.tokenIdentifier !== undefined;
      const needsAuthUserId = profile.authUserId === undefined;

      if (!needsAuthUserId) {
        // Already migrated — just strip tokenIdentifier if still present
        if (hasTokenIdentifier) {
          await ctx.db.patch(profile._id, { tokenIdentifier: undefined });
          stripped++;
        }
        skipped++;
        continue;
      }

      const matchedAuthUserId = emailToAuthUserId.get(profile.email.toLowerCase()) ?? null;

      if (matchedAuthUserId) {
        // Single patch: set authUserId + strip tokenIdentifier together
        const patch: Record<string, unknown> = { authUserId: matchedAuthUserId };
        if (hasTokenIdentifier) {
          patch.tokenIdentifier = undefined;
          stripped++;
        }
        await ctx.db.patch(profile._id, patch);
        migrated++;
      } else {
        // No auth user found — strip tokenIdentifier but leave unclaimed
        if (hasTokenIdentifier) {
          await ctx.db.patch(profile._id, { tokenIdentifier: undefined });
          stripped++;
        }
        noMatch++;
      }
    }

    return { migrated, skipped, noMatch, stripped, total: profiles.length };
  },
});
