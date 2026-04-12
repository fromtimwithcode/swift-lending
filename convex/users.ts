import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUser } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_BULK_OPERATION_SIZE } from "./lib/constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string) {
  if (!EMAIL_REGEX.test(email)) {
    throw new Error("Invalid email format");
  }
}

/** Max age for unclaimed pending profiles (30 days in ms) */
const PENDING_PROFILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    return profile;
  },
});

export const claimProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if user already has a profile linked
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (existing) return existing._id;

    // Look for a pre-created profile with matching email (admin-created borrower)
    const email = identity.email?.toLowerCase();
    if (email) {
      const pendingProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();

      if (pendingProfile && pendingProfile.tokenIdentifier === "") {
        // Reject stale pending profiles (older than 30 days)
        const profileAge = Date.now() - pendingProfile._creationTime;
        if (profileAge > PENDING_PROFILE_MAX_AGE_MS) {
          throw new Error("This invitation has expired. Please contact an administrator for a new invitation.");
        }

        await ctx.db.patch(pendingProfile._id, {
          tokenIdentifier: identity.tokenIdentifier,
          onboardedAt: Date.now(),
        });
        return pendingProfile._id;
      }
    }

    // No profile found — return null (admin must create one)
    return null;
  },
});

export const getAllBorrowers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const borrowers = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "borrower"))
      .collect();

    // Batch-load all loans once instead of N+1 queries
    const allLoans = await ctx.db.query("loans").collect();
    const loansByBorrower = new Map<string, typeof allLoans>();
    for (const loan of allLoans) {
      const existing = loansByBorrower.get(loan.borrowerId) ?? [];
      existing.push(loan);
      loansByBorrower.set(loan.borrowerId, existing);
    }

    const borrowersWithStats = borrowers.map((borrower) => {
      const loans = loansByBorrower.get(borrower._id) ?? [];
      const activeLoans = loans.filter((l) => l.status !== "closed" && l.status !== "denied");
      const totalCapital = loans.reduce((sum, l) => sum + l.loanAmount, 0);

      return {
        ...borrower,
        loanCount: loans.length,
        activeLoanCount: activeLoans.length,
        totalCapital,
      };
    });

    return borrowersWithStats;
  },
});

export const getAdminUsers = query({
  args: {},
  handler: async (ctx) => {
    // Any authenticated user can see admin/developer contacts (needed for messaging)
    await requireUser(ctx);

    const admins = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    const developers = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "developer"))
      .collect();

    return [...admins, ...developers].map((a) => ({
      _id: a._id,
      displayName: a.displayName,
      email: a.email,
    }));
  },
});

export const createBorrower = mutation({
  args: {
    email: v.string(),
    displayName: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const displayName = args.displayName.trim();
    const email = args.email.trim().toLowerCase();
    const phone = args.phone?.trim() || undefined;
    const company = args.company?.trim() || undefined;
    if (!displayName) throw new Error("Display name cannot be empty");
    if (!email) throw new Error("Email cannot be empty");
    validateEmail(email);

    // Check if email already exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) throw new Error("A user with this email already exists");

    const id = await ctx.db.insert("userProfiles", {
      tokenIdentifier: "", // Will be claimed when borrower logs in
      role: "borrower",
      displayName,
      email,
      phone,
      company,
      isActive: true,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "user.createBorrower",
      entityType: "user",
      entityId: id,
      details: `Created borrower "${displayName}" (${email})`,
    });

    return id;
  },
});

export const createInvestor = mutation({
  args: {
    email: v.string(),
    displayName: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const displayName = args.displayName.trim();
    const email = args.email.trim().toLowerCase();
    const phone = args.phone?.trim() || undefined;
    const company = args.company?.trim() || undefined;
    if (!displayName) throw new Error("Display name cannot be empty");
    if (!email) throw new Error("Email cannot be empty");
    validateEmail(email);

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) throw new Error("A user with this email already exists");

    const id = await ctx.db.insert("userProfiles", {
      tokenIdentifier: "",
      role: "investor",
      displayName,
      email,
      phone,
      company,
      isActive: true,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "user.createInvestor",
      entityType: "user",
      entityId: id,
      details: `Created investor "${displayName}" (${email})`,
    });

    return id;
  },
});

export const getAllInvestors = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const investors = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "investor"))
      .collect();

    // Batch-load all investments once instead of N+1 queries
    const allInvestments = await ctx.db.query("investments").collect();
    const investmentsByInvestor = new Map<string, typeof allInvestments>();
    for (const inv of allInvestments) {
      const existing = investmentsByInvestor.get(inv.investorId) ?? [];
      existing.push(inv);
      investmentsByInvestor.set(inv.investorId, existing);
    }

    const investorsWithStats = investors.map((investor) => {
      const investments = investmentsByInvestor.get(investor._id) ?? [];
      const totalInvested = investments.reduce(
        (sum, i) => sum + i.investmentAmount,
        0
      );

      return {
        ...investor,
        investmentCount: investments.length,
        totalInvested,
      };
    });

    return investorsWithStats;
  },
});

export const bulkToggleActive = mutation({
  args: {
    userIds: v.array(v.id("userProfiles")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (args.userIds.length > MAX_BULK_OPERATION_SIZE) {
      throw new Error(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }

    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const userId of args.userIds) {
      if (userId === admin._id) {
        results.push({ id: userId, success: false, error: "Cannot modify your own account" });
        continue;
      }
      const user = await ctx.db.get(userId);
      if (!user) {
        results.push({ id: userId, success: false, error: "User not found" });
        continue;
      }
      await ctx.db.patch(userId, { isActive: args.isActive });
      results.push({ id: userId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "user.bulkToggleActive",
      entityType: "user",
      details: `Bulk ${args.isActive ? "activated" : "deactivated"} ${successCount}/${args.userIds.length} users`,
    });

    return results;
  },
});

export const toggleUserActive = mutation({
  args: { id: v.id("userProfiles") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (admin._id === args.id) {
      throw new Error("Cannot deactivate your own account");
    }

    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.id, { isActive: !user.isActive });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "user.toggleActive",
      entityType: "user",
      entityId: args.id,
      details: `${user.isActive ? "Deactivated" : "Activated"} user "${user.displayName}"`,
    });

    return args.id;
  },
});

export const updateUserProfile = mutation({
  args: {
    id: v.id("userProfiles"),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("User not found");

    // Required field validation + trim
    if (fields.displayName !== undefined) {
      fields.displayName = fields.displayName.trim();
      if (!fields.displayName) throw new Error("Display name cannot be empty");
    }
    if (fields.email !== undefined) {
      fields.email = fields.email.trim().toLowerCase();
      if (!fields.email) throw new Error("Email cannot be empty");
    }
    // Track which optional fields should be cleared
    const clearPhone = fields.phone !== undefined && !fields.phone.trim();
    const clearCompany = fields.company !== undefined && !fields.company.trim();
    if (fields.phone !== undefined) {
      fields.phone = fields.phone.trim() || undefined;
    }
    if (fields.company !== undefined) {
      fields.company = fields.company.trim() || undefined;
    }

    // Email format and uniqueness check
    if (fields.email) validateEmail(fields.email);
    if (fields.email && fields.email !== existing.email) {
      const emailTaken = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q) => q.eq("email", fields.email!))
        .unique();
      if (emailTaken) throw new Error("A user with this email already exists");
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    // Allow clearing optional fields
    if (clearPhone) updates.phone = undefined;
    if (clearCompany) updates.company = undefined;
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "user.updateProfile",
      entityType: "user",
      entityId: id,
      details: `Updated profile for "${existing.displayName}"`,
    });

    return id;
  },
});
