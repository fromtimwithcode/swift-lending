import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  userProfiles: defineTable({
    tokenIdentifier: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("developer"),
      v.literal("borrower"),
      v.literal("investor")
    ),
    displayName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    isActive: v.boolean(),
    onboardedAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  loans: defineTable({
    borrowerId: v.id("userProfiles"),
    borrowerName: v.string(),
    entityName: v.string(),
    propertyAddress: v.string(),
    purchasePrice: v.number(),
    loanAmount: v.number(),
    afterRepairValue: v.optional(v.number()),
    rehabBudgetTotal: v.optional(v.number()),
    closeDate: v.optional(v.string()),
    maturityDate: v.optional(v.string()),
    terms: v.string(),
    interestRate: v.number(),
    monthlyPayment: v.number(),
    paymentDueDay: v.optional(v.number()),
    pointsEarned: v.number(),
    monthlyInterestEarned: v.optional(v.number()),
    status: v.union(
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("additional_info_needed"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("funded"),
      v.literal("sent_to_title"),
      v.literal("closed")
    ),
    titleCompany: v.optional(v.string()),
    titleCompanyContact: v.optional(v.string()),
    closingStatementFileId: v.optional(v.id("_storage")),
    drawFundsTotal: v.optional(v.number()),
    drawFundsUsed: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id("userProfiles"),
  })
    .index("by_borrowerId", ["borrowerId"])
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"]),

  rehabBudgetItems: defineTable({
    loanId: v.id("loans"),
    category: v.union(
      v.literal("demo"),
      v.literal("exterior"),
      v.literal("interior"),
      v.literal("dumpster"),
      v.literal("miscellaneous"),
      v.literal("overage")
    ),
    itemName: v.string(),
    allocatedAmount: v.number(),
    actualAmount: v.optional(v.number()),
  }).index("by_loanId", ["loanId"]),

  drawRequests: defineTable({
    loanId: v.id("loans"),
    borrowerId: v.id("userProfiles"),
    amountRequested: v.number(),
    workDescription: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("denied")
    ),
    adminNotes: v.optional(v.string()),
    reviewedBy: v.optional(v.id("userProfiles")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_loanId", ["loanId"])
    .index("by_borrowerId", ["borrowerId"])
    .index("by_status", ["status"]),

  documents: defineTable({
    ownerId: v.id("userProfiles"),
    loanId: v.optional(v.id("loans")),
    drawRequestId: v.optional(v.id("drawRequests")),
    type: v.union(
      v.literal("articles"),
      v.literal("operating_agreement"),
      v.literal("closing_statement"),
      v.literal("wire_instructions"),
      v.literal("property_photo"),
      v.literal("receipt"),
      v.literal("lien_waiver"),
      v.literal("rehab_budget"),
      v.literal("other")
    ),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_loanId", ["loanId"])
    .index("by_type", ["type"])
    .index("by_drawRequestId", ["drawRequestId"])
    .index("by_loanId_and_type", ["loanId", "type"]),

  messages: defineTable({
    senderId: v.id("userProfiles"),
    recipientId: v.id("userProfiles"),
    loanId: v.optional(v.id("loans")),
    content: v.string(),
    isRead: v.boolean(),
  })
    .index("by_recipientId", ["recipientId"])
    .index("by_senderId", ["senderId"])
    .index("by_loanId", ["loanId"])
    .index("by_senderId_recipientId", ["senderId", "recipientId"])
    .index("by_recipientId_isRead", ["recipientId", "isRead"]),

  investments: defineTable({
    investorId: v.id("userProfiles"),
    investmentAmount: v.number(),
    inceptionDate: v.number(),
    interestRate: v.number(),
    totalPaymentsReceived: v.number(),
    nextPaymentDate: v.number(),
    notes: v.optional(v.string()),
  }).index("by_investorId", ["investorId"]),

  notifications: defineTable({
    recipientId: v.id("userProfiles"),
    type: v.union(
      v.literal("loan_status_changed"),
      v.literal("draw_reviewed"),
      v.literal("draw_submitted"),
      v.literal("application_submitted"),
      v.literal("document_uploaded"),
      v.literal("message_received"),
      v.literal("payment_recorded"),
      v.literal("payment_overdue")
    ),
    title: v.string(),
    body: v.string(),
    loanId: v.optional(v.id("loans")),
    drawRequestId: v.optional(v.id("drawRequests")),
    isRead: v.boolean(),
    emailSent: v.boolean(),
  })
    .index("by_recipientId", ["recipientId"])
    .index("by_recipientId_and_isRead", ["recipientId", "isRead"]),

  loanPayments: defineTable({
    loanId: v.id("loans"),
    amount: v.number(),
    paymentDate: v.string(),
    dueDate: v.string(),
    method: v.union(
      v.literal("ach"),
      v.literal("wire"),
      v.literal("check"),
      v.literal("other")
    ),
    status: v.union(
      v.literal("on_time"),
      v.literal("late"),
      v.literal("partial"),
      v.literal("missed")
    ),
    notes: v.optional(v.string()),
    recordedBy: v.id("userProfiles"),
  })
    .index("by_loanId", ["loanId"])
    .index("by_status", ["status"]),

  propertyComps: defineTable({
    loanId: v.id("loans"),
    address: v.string(),
    salePrice: v.number(),
    saleDate: v.string(),
    sqft: v.number(),
    bedrooms: v.number(),
    bathrooms: v.number(),
    distanceMiles: v.number(),
    yearBuilt: v.number(),
    source: v.string(),
  }).index("by_loanId", ["loanId"]),

  activityLog: defineTable({
    userId: v.id("userProfiles"),
    userName: v.string(),
    action: v.string(),
    entityType: v.union(
      v.literal("loan"),
      v.literal("draw"),
      v.literal("user"),
      v.literal("investment"),
      v.literal("payment"),
      v.literal("document"),
      v.literal("message"),
      v.literal("system")
    ),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_entityType", ["entityType"])
    .index("by_action", ["action"]),
});

export default schema;
