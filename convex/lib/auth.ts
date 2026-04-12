import { QueryCtx, MutationCtx } from "../_generated/server";

type Role = "admin" | "developer" | "borrower" | "investor";

/** Returns true for roles that have admin-level access. */
export function isAdminLike(role: string): boolean {
  return role === "admin" || role === "developer";
}

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
  role: Role
) {
  const profile = await requireUser(ctx);
  if (role === "admin") {
    // Accept both admin and developer
    if (!isAdminLike(profile.role)) {
      throw new Error(`Requires ${role} role`);
    }
  } else if (profile.role !== role) {
    throw new Error(`Requires ${role} role`);
  }
  return profile;
}

export async function requireAnyRole(
  ctx: QueryCtx | MutationCtx,
  roles: Role[]
) {
  const profile = await requireUser(ctx);
  // If admin is in the allowed list, also accept developer
  const effectiveRoles = new Set<string>(roles);
  if (effectiveRoles.has("admin")) {
    effectiveRoles.add("developer");
  }
  if (!effectiveRoles.has(profile.role)) {
    throw new Error(`Requires one of: ${roles.join(", ")}`);
  }
  return profile;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, "admin");
}

/** Get all admin and developer users (for notification recipients). */
export async function getAdminLikeUsers(ctx: QueryCtx | MutationCtx) {
  const admins = await ctx.db
    .query("userProfiles")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .collect();
  const developers = await ctx.db
    .query("userProfiles")
    .withIndex("by_role", (q) => q.eq("role", "developer"))
    .collect();
  return [...admins, ...developers];
}
