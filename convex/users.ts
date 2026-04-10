import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

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
    const email = identity.email;
    if (email) {
      const pendingProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();

      if (pendingProfile && pendingProfile.tokenIdentifier === "") {
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

    // Get loan counts for each borrower
    const borrowersWithStats = await Promise.all(
      borrowers.map(async (borrower) => {
        const loans = await ctx.db
          .query("loans")
          .withIndex("by_borrowerId", (q) => q.eq("borrowerId", borrower._id))
          .collect();

        const activeLoans = loans.filter((l) => l.status !== "closed" && l.status !== "denied");
        const totalCapital = loans.reduce((sum, l) => sum + l.loanAmount, 0);

        return {
          ...borrower,
          loanCount: loans.length,
          activeLoanCount: activeLoans.length,
          totalCapital,
        };
      })
    );

    return borrowersWithStats;
  },
});

export const getAdminUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const admins = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    return admins.map((a) => ({
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
    await requireAdmin(ctx);

    // Check if email already exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) throw new Error("A user with this email already exists");

    const id = await ctx.db.insert("userProfiles", {
      tokenIdentifier: "", // Will be claimed when borrower logs in
      role: "borrower",
      displayName: args.displayName,
      email: args.email,
      phone: args.phone,
      company: args.company,
      isActive: true,
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
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) throw new Error("A user with this email already exists");

    const id = await ctx.db.insert("userProfiles", {
      tokenIdentifier: "",
      role: "investor",
      displayName: args.displayName,
      email: args.email,
      phone: args.phone,
      company: args.company,
      isActive: true,
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

    const investorsWithStats = await Promise.all(
      investors.map(async (investor) => {
        const investments = await ctx.db
          .query("investments")
          .withIndex("by_investorId", (q) => q.eq("investorId", investor._id))
          .collect();

        const totalInvested = investments.reduce(
          (sum, i) => sum + i.investmentAmount,
          0
        );

        return {
          ...investor,
          investmentCount: investments.length,
          totalInvested,
        };
      })
    );

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

    if (args.userIds.length > 50) throw new Error("Maximum 50 items per bulk operation");

    for (const userId of args.userIds) {
      if (userId === admin._id) continue; // skip self-deactivation
      const user = await ctx.db.get(userId);
      if (!user) continue;
      await ctx.db.patch(userId, { isActive: args.isActive });
    }
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
    await requireAdmin(ctx);

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("User not found");

    // Email uniqueness check
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
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }
    return id;
  },
});
