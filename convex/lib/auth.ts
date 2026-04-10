import { QueryCtx, MutationCtx } from "../_generated/server";

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (!profile) {
    return null;
  }

  return profile;
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const profile = await getCurrentUser(ctx);
  if (!profile) {
    throw new Error("User profile not found");
  }
  if (!profile.isActive) {
    throw new Error("Account is deactivated");
  }
  return profile;
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  role: "admin" | "borrower" | "investor"
) {
  const profile = await requireUser(ctx);
  if (profile.role !== role) {
    throw new Error(`Requires ${role} role`);
  }
  return profile;
}

export async function requireAnyRole(
  ctx: QueryCtx | MutationCtx,
  roles: Array<"admin" | "borrower" | "investor">
) {
  const profile = await requireUser(ctx);
  if (!roles.includes(profile.role as "admin" | "borrower" | "investor")) {
    throw new Error(`Requires one of: ${roles.join(", ")}`);
  }
  return profile;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "admin");
}
