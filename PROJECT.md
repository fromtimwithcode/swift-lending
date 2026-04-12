# Swift Capital Lending Portal

## Overview

Internal portal for Swift Capital, a hard-money lender that currently tracks loans, borrowers, investors, and revenue in Google Sheets. This app replaces those sheets with a secure, role-based web portal.

## Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack)
- **Backend**: Convex (real-time database, serverless functions)
- **Auth**: Convex Auth with Google OAuth
- **Styling**: Tailwind CSS v4, CSS variables, OKLch color space
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Icons**: Lucide React, HugeIcons
- **Components**: @base-ui/react (headless), CVA variants

## User Roles

| Role | Access | Status |
|------|--------|--------|
| **Admin** | Full loan management, KPIs, borrower/investor management, approvals | Phase 1 |
| **Developer** | Full admin access + activity log visibility (super-admin) | Phase 6 |
| **Borrower** | Loan status, draw requests, applications, document uploads | Phase 2 |
| **Investor** | Investment tracking, payment history | Phase 3 |

### Admin Creation

The first admin must be seeded manually in the Convex dashboard by inserting a `userProfiles` document. All other users (borrowers, investors) are created by admins through the portal.

---

## Phase 1 — Admin Foundation (Completed)

### Database Schema
- [x] `userProfiles` — role-based user records linked to auth via `tokenIdentifier`
- [x] `loans` — core loan records (system of record)
- [x] `rehabBudgetItems` — line items for rehab budgets
- [x] `drawRequests` — borrower draw request records
- [x] `documents` — file storage references
- [x] `messages` — communication system records
- [x] `investments` — fund investor records

### Auth & Access Control
- [x] Server-side auth helpers (`getCurrentUser`, `requireAdmin`, `requireRole`)
- [x] Client-side role-based routing (admin → `/dashboard/admin`, etc.)
- [x] Dashboard layout with auth guard, loading states, "account pending" screen
- [x] Profile claiming flow (admin pre-creates borrower → borrower logs in → profile linked)

### Dashboard Shell
- [x] Collapsible sidebar with role-based navigation
- [x] Sticky topbar with mobile hamburger menu
- [x] Dark/light mode toggle (next-themes)
- [x] Dark mode CSS variables (deep navy palette)
- [x] Responsive: desktop (full sidebar), tablet (collapsed icons), mobile (overlay drawer)

### Admin KPI Dashboard
- [x] 5 KPI cards: Total Loans, Total Capital, Closed Loan Revenue, Monthly Cash Flow, Pipeline Value
- [x] Loan Volume by Month bar chart
- [x] Loan Status Distribution donut chart
- [x] Recent Loans table with row click → detail
- [x] All chart/table data served from single `getOverviewStats` query (no duplicate fetching)

### Admin Loan Management
- [x] Loans list with tabs (All / Pipeline / Closed), search, sort
- [x] Loan detail page with inline editing
- [x] Status changer (clickable status badges)
- [x] New Loan form (multi-section: borrower, property, terms, title, draws, notes)

### Admin Borrower Management
- [x] Borrowers list with loan stats (active loans, total capital)
- [x] Add Borrower form (email, name, company, phone)

### Reusable Components
- [x] `KpiCard` — stat card with icon and trend
- [x] `StatusBadge` — color-coded loan status pill
- [x] `DataTable` — sortable table with click handlers
- [x] `PageHeader` — page title + description + actions
- [x] `EmptyState` — illustrated empty state with CTA

---

## Phase 2 — Borrower Portal & Document Management (Completed)

### Borrower Dashboard
- [x] Borrower home with KPI cards (Active Loans, Total Borrowed, Pending Draws)
- [x] Loans table with row click → detail
- [x] Loan detail view (read-only) with status timeline
- [x] Loan status timeline/tracker (horizontal stepper with denied/info-needed states)

### Loan Application
- [x] Borrower-facing loan application form (entity, property, loan request, notes)
- [x] Application submission creates loan with `status: "submitted"`, zeroes for admin-set fields
- [x] Applications appear in admin Applications page

### Draw Requests
- [x] Borrower submits draw request (select funded loan, amount, work description)
- [x] Shows remaining draw funds on the form (including pending draws and available balance)
- [x] Draw amount validated against available funds (total - used - pending) on both client and server
- [x] Work description trimmed and validated non-empty server-side
- [x] Admin reviews and approves/denies draws with notes (success feedback shown)
- [x] Approved draws auto-update `loan.drawFundsUsed`
- [x] Admin draw request list with status tab filters
- [x] Admin draw detail page with review actions
- [x] Bulk draw review handles partial failures (per-item results shown to user)

### Document Management
- [x] File upload via Convex storage (generateUploadUrl → POST → saveDocument)
- [x] Document types: articles, operating agreement, closing statement, wire instructions, property photos, receipts, lien waivers, rehab budgets, other
- [x] Documents attached to loans and/or draw requests
- [x] Borrower document page with type filters, upload, download, delete
- [x] Upload from loan detail page and admin loan detail page
- [x] Admin document review via borrower detail page

### Messaging
- [x] In-app messaging between admin and borrowers (two-panel conversation UI)
- [x] Messages optionally tied to specific loans
- [x] Read/unread tracking with auto mark-as-read on view
- [x] Unread count badge on Messages nav item in sidebar
- [x] "New Message" flow for borrowers to contact admins

### Admin Enhancements
- [x] Applications page (filtered: submitted, under_review, additional_info_needed)
- [x] Admin loan detail: placeholder sections replaced with real documents list + draw requests
- [x] Borrower detail page (profile, all loans, draws, documents, message link)
- [x] Borrowers list rows clickable → borrower detail

---

## Phase 3 — Investor Portal & User Management (Completed)

### Fund Investor Portal
- [x] Investor dashboard with portfolio overview KPIs (Total Invested, Payments Received, Avg Interest Rate, Next Payment)
- [x] Investment tracking table (amount, inception date, interest rate, payments received, next payment, notes)
- [x] Payments page — payment-focused view of investment data
- [x] Investor messaging (same two-panel UI pattern, uses existing backend)

### Rehab Budget Management
- [x] Rehab budget line-item editor component on admin loan detail (uses `rehabBudgetItems` table)
- [x] Categories: demo, exterior, interior, dumpster, miscellaneous, overage
- [x] Allocated vs. actual amount tracking per line item with variance column
- [x] Budget summary bar (total allocated, total actual, remaining)
- [x] Inline add/edit/delete budget items

### Admin Investor Management
- [x] Investors list page with stats (investment count, total invested, active/inactive badge)
- [x] Add Investor form (email, name, company, phone — same pattern as borrowers)
- [x] Investor detail page with profile editing, toggle active/inactive, message link
- [x] Inline investment CRUD (add investment form, edit investment inline in table)

### Admin User Management & Settings
- [x] Toggle borrower active/inactive from borrower detail page (with confirmation)
- [x] Inline profile editing on borrower detail page (name, email, phone, company)
- [x] Toggle investor active/inactive from investor detail page
- [x] Inline profile editing on investor detail page
- [x] Settings page with Borrowers/Investors tabs and quick active toggles
- [x] Email uniqueness check on profile updates
- [x] Admin self-deactivation prevention

---

## Phase 4 — Notifications, Payments & Reporting (Completed)

### Notifications System
- [x] `notifications` table with type-based categorization (loan_status_changed, draw_reviewed, draw_submitted, application_submitted, document_uploaded, message_received, payment_recorded, payment_overdue)
- [x] `createNotification` internalMutation — called from existing mutations to fire in-app + email
- [x] Email delivery via Resend (`convex/email.ts`, Node.js action, fire-and-forget)
- [x] Notification bell in topbar with unread badge + dropdown (recent 10, click to navigate, mark all read)
- [x] Full notification feed pages for all 3 roles
- [x] Sidebar notification nav items with unread count badges for all roles

### Notification Triggers
- [x] Loan status change → notify borrower
- [x] Draw request reviewed → notify borrower
- [x] Loan application submitted → notify all admins
- [x] Draw request submitted → notify all admins
- [x] Document uploaded (borrower) → notify all admins
- [x] Message sent → notify recipient

### Loan Payment Tracking
- [x] `loanPayments` table (amount, dates, method, status, notes, recordedBy)
- [x] Admin loan detail: payment stats bar (total received, count, on-time %, late, missed)
- [x] Admin loan detail: inline record payment form (amount pre-filled, date, method, status, notes)
- [x] Admin loan detail: payment history DataTable with delete
- [x] Borrower loan detail: read-only payment history
- [x] Payment recorded → notify borrower

### Closing Statement
- [x] Admin loan detail: attach/view/replace/remove closing statement file
- [x] Uses existing `closingStatementFileId` field on loans schema
- [x] Direct upload to loan record (not documents table)

### Advanced Reporting
- [x] Admin dashboard: "Revenue by Month" bar chart from payment data
- [x] Admin dashboard: "Borrower Performance" table (loans, capital, payments, late count, on-time rate)
- [x] `getBorrowerPerformance` query aggregates loans + payments per borrower

### Investor Statements
- [x] Investor statements page with KPIs (Total Invested, Total Returns, Weighted Avg Rate, Est. Annual Income)
- [x] Investment breakdown table (amount, rate, monthly return, annual return, total received, inception)
- [x] `getInvestmentStatement` query with computed return fields

---

## Phase 5 — Search, Export, Bulk Ops & Property Comps (Completed)

### Advanced Search & Filtering
- [x] `SearchInput` component — debounced (300ms) text search with icon
- [x] `StatusTabFilter` component — extracted shared tab pattern from inline duplicates
- [x] Admin Loans: search by borrower, address, or entity + tab filter (All/Pipeline/Closed)
- [x] Admin Applications: search by borrower/address/entity + tab filter (All/Submitted/Under Review/Info Needed)
- [x] Admin Draws: search by borrower/property/description + tab filter (All/Pending/Under Review/Approved/Denied)
- [x] Admin Borrowers: search by name/email/company
- [x] Admin Investors: search by name/email/company
- [x] Admin Settings: search within Borrowers and Investors tabs

### Export / Download Reports
- [x] `lib/export.ts` — client-side CSV, Excel (xlsx), and PDF (jspdf-autotable) generation with dynamic imports
- [x] `ExportButton` component — dropdown with CSV/Excel/PDF options
- [x] Export on: Admin Loans, Applications, Draws, Borrowers, Investors, Borrower Documents
- [x] Export respects current search/filter (exports visible data)
- [x] "Export Selected" on loans page exports only checked rows

### Bulk Operations
- [x] `DataTable` enhanced with optional selectable rows (checkbox column, select-all toggle)
- [x] `BulkActionBar` component — floating bottom bar with action buttons + clear
- [x] Admin Loans: bulk status change (status picker dropdown), export selected
- [x] Admin Draws: bulk approve, bulk deny (with notifications per draw)
- [x] Admin Borrowers: bulk activate/deactivate
- [x] Admin Investors: bulk activate/deactivate
- [x] Backend: `admin.bulkUpdateLoanStatus`, `users.bulkToggleActive`, `draws.bulkReviewDrawRequests`, `loanPayments.bulkDeletePayments`, `notifications.bulkMarkAsRead`

### AI Property Comps (Mock/Placeholder)
- [x] `propertyComps` table (address, salePrice, saleDate, sqft, bed/bath, distance, yearBuilt, source)
- [x] `convex/comps.ts` — `getCompsForLoan` query, `fetchComps` mutation (generates 3–5 mock comps based on loan's purchase price)
- [x] `PropertyComps` component on admin loan detail — fetch button, comp table with "mock" source badge
- [x] Designed for future real API integration (swap `source: "mock"` → `source: "api"`)

---

## Phase 6 — Developer Role & Activity Log (Completed)

### Developer Role
- [x] Added `"developer"` to `userProfiles.role` union in schema
- [x] `isAdminLike(role)` helper — returns true for `"admin"` or `"developer"`
- [x] `requireRole(ctx, "admin")` and `requireAnyRole(ctx, ["admin", ...])` automatically accept developers
- [x] `getAdminLikeUsers(ctx)` helper — queries both admin and developer profiles (for notifications)
- [x] All hardcoded `role === "admin"` checks replaced with `isAdminLike()` (messages, draws, documents)
- [x] Notification recipients (application submitted, draw submitted, document uploaded) include developers
- [x] Dashboard redirect: developer → `/dashboard/admin`
- [x] Sidebar: developer gets full admin navigation
- [x] Notification bell: developer treated as admin for link routing
- [x] `getAdminUsers` returns both admins and developers, accessible to all authenticated users (fixes borrower/investor "New Message" flow)

### Activity Log
- [x] `activityLog` table (userId, userName, action, entityType, entityId, details, metadata)
- [x] `activityLog.log` — `internalMutation` (secure, cannot be called from client)
- [x] `activityLog.getRecentActivity` — admin-only query, returns latest 100 entries
- [x] `activityLog.getActivityForEntity` — admin-only query by entityId
- [x] All write mutations instrumented with activity logging (26 log points across 7 files)
- [x] `ACTIVITY_ACTION_LABELS` (28 action→label mappings) and `ENTITY_TYPE_LABELS` in constants
- [x] Activity Log page with table, entity type filter tabs (All/Loan/Draw/User/Investment/Payment/Document), search
- [x] Activity Log nav item in admin sidebar (visible to admins and developers)

### Instrumented Mutations
- `convex/admin.ts` — createLoan, updateLoan, updateLoanStatus, attachClosingStatement, removeClosingStatement, bulkUpdateLoanStatus, createInvestment, updateInvestment, deleteInvestment, addRehabBudgetItem, updateRehabBudgetItem, deleteRehabBudgetItem
- `convex/draws.ts` — reviewDrawRequest, bulkReviewDrawRequests
- `convex/users.ts` — createBorrower, createInvestor, toggleUserActive, bulkToggleActive, updateUserProfile
- `convex/loanPayments.ts` — recordPayment, deletePayment, bulkDeletePayments
- `convex/documents.ts` — deleteDocument
- `convex/comps.ts` — fetchComps
- `convex/borrower.ts` — submitApplication, submitDrawRequest

---

## File Structure

```
convex/
  schema.ts               Full schema (11 tables: userProfiles, loans, rehabBudgetItems, drawRequests, documents, messages, investments, notifications, loanPayments, propertyComps, activityLog)
  auth.ts                 Auth providers (Google OAuth)
  auth.config.ts          JWT config
  http.ts                 HTTP routes
  lib/auth.ts             getCurrentUser, requireAdmin, requireRole, requireAnyRole, isAdminLike, getAdminLikeUsers
  lib/constants.ts        Shared constants (MAX_BULK_OPERATION_SIZE, LOAN_STATUS_LABELS, DRAW_STATUS_LABELS, REHAB_CATEGORIES, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, ACTIVITY_ACTION_LABELS, ENTITY_TYPE_LABELS, formatCurrencyPlain)
  admin.ts                Admin queries + mutations (getOverviewStats, getLoans, getLoan, createLoan, updateLoan, updateLoanStatus, bulkUpdateLoanStatus, getApplications, getBorrowerDetail, getRehabBudgetItems, addRehabBudgetItem, updateRehabBudgetItem, deleteRehabBudgetItem, createInvestment, updateInvestment, getInvestorDetail, attachClosingStatement, removeClosingStatement, getClosingStatementUrl, getBorrowerPerformance)
  users.ts                User profile management (getMe, claimProfile, getAllBorrowers, getAdminUsers, createBorrower, createInvestor, getAllInvestors, bulkToggleActive, toggleUserActive, updateUserProfile)
  borrower.ts             Borrower queries + mutations (getMyLoans, getMyLoan, submitApplication, getMyDrawRequests, getDrawRequestsForLoan, submitDrawRequest, getMyLoanPayments)
  investor.ts             Investor queries (getMyInvestments, getMyInvestment, getPortfolioStats, getInvestmentStatement)
  documents.ts            Document management (generateUploadUrl, saveDocument, getDocumentsForLoan, getMyDocuments, getAllDocuments, deleteDocument)
  draws.ts                Draw request management (getAllDrawRequests, getDrawRequestsForLoan, getDrawRequest, bulkReviewDrawRequests, reviewDrawRequest)
  comps.ts                Property comps (getCompsForLoan, saveComps [internal], fetchComps)
  messages.ts             Messaging (getConversations, getDirectMessages, sendMessage, markMessagesRead, getUnreadCount)
  notifications.ts        Notification system (getMyNotifications, getUnreadCount, markAsRead, markAllRead, bulkMarkAsRead, createNotification [internal], markEmailSent [internal])
  email.ts                Email delivery via Resend ("use node" action: sendNotificationEmail [internal])
  loanPayments.ts         Payment tracking (getPaymentsForLoan, getAllPaymentsSummary, recordPayment, bulkDeletePayments, deletePayment)
  activityLog.ts          Activity logging (log [internal], getRecentActivity, getActivityForEntity)

lib/
  utils.ts                Utility functions (cn)
  format.ts               Shared currency formatters (formatCurrency, formatCurrencyShort)
  export.ts               Client-side export: exportToCsv, exportToExcel, exportToPdf

app/
  layout.tsx              Root layout (auth + theme providers)
  globals.css             Light + dark mode CSS variables
  dashboard/
    layout.tsx            Auth guard + dashboard shell
    page.tsx              Role-based redirect
    admin/
      page.tsx            KPI overview + revenue chart + borrower performance
      loans/page.tsx      Loans list
      loans/[id]/page.tsx Loan detail (closing statement, payments, documents, draws)
      loans/new/page.tsx  New loan form
      borrowers/page.tsx  Borrowers list (clickable rows)
      borrowers/[id]/page.tsx  Borrower detail (profile editing, toggle active, loans, draws, documents)
      borrowers/new/page.tsx   Add borrower
      investors/page.tsx       Investors list (stats, active/inactive badge)
      investors/[id]/page.tsx  Investor detail (profile editing, toggle active, investment CRUD)
      investors/new/page.tsx   Add investor
      applications/page.tsx    Pending loan applications
      draws/page.tsx           All draw requests (tab filters)
      draws/[id]/page.tsx      Draw detail + review actions
      messages/page.tsx        Admin messaging (two-panel)
      notifications/page.tsx   Notification feed
      settings/page.tsx        User management (Borrowers/Investors tabs, quick toggles)
      activity/page.tsx        Activity log (table, entity type filter tabs, search)
    borrower/
      page.tsx            My Loans dashboard (KPIs + table)
      loans/[id]/page.tsx Loan detail (read-only, timeline, payments, draws, documents)
      apply/page.tsx      Loan application form
      draws/page.tsx      Draw requests list (tab filters)
      draws/new/page.tsx  New draw request form
      documents/page.tsx  Documents (upload, download, delete, type filter)
      messages/page.tsx   Borrower messaging (two-panel)
      notifications/page.tsx  Notification feed
    investor/
      page.tsx            Portfolio dashboard (KPIs + investments table)
      payments/page.tsx   Payment tracking table
      statements/page.tsx Investment statements + KPIs + breakdown
      messages/page.tsx   Investor messaging (two-panel)
      notifications/page.tsx  Notification feed

components/
  theme-provider.tsx      next-themes wrapper
  dashboard/
    sidebar.tsx           Collapsible role-based sidebar (with message + notification badges)
    topbar.tsx            Sticky topbar (with notification bell)
    theme-toggle.tsx      Dark/light toggle
    notification-bell.tsx Notification bell dropdown with unread badge
    notification-feed.tsx Full notification list (shared by all roles)
    kpi-card.tsx          Stat card
    status-badge.tsx      Status pill (loan, draw, payment statuses + methods)
    data-table.tsx        Sortable table with optional selectable rows
    page-header.tsx       Page title + actions
    search-input.tsx      Debounced search input with icon
    status-tab-filter.tsx Reusable tab filter bar
    export-button.tsx     Export dropdown (CSV/Excel/PDF)
    bulk-action-bar.tsx   Floating bottom bar for bulk actions
    property-comps.tsx    Property comps table with mock fetch
    empty-state.tsx       Empty state CTA
    loan-status-timeline.tsx  Horizontal stepper for loan progression
    file-upload-dialog.tsx    Modal for Convex file upload
    message-thread.tsx        Chat bubbles with auto-scroll + mark-read
    conversation-list.tsx     Conversation list with unread badges
    rehab-budget-editor.tsx   Inline CRUD for rehab budget line items (used in loan detail)
```

---

## Known Issues & Notes

- First admin/developer must be manually seeded in Convex dashboard
- Email/OTP login UI exists but backend not wired (Google OAuth only for now)
- Loan dates stored as strings (MM/DD/YYYY); investment dates use timestamps (`v.number()`)
- Payment dates stored as strings (MM/DD/YYYY) with full calendar validation (impossible dates like 02/31 rejected)
- `getOverviewStats` uses `.collect()` on all loans — fine for now, may need optimization at scale
- Messaging queries bounded with `.take(5000)` on sent/received — works at moderate volume, may need pagination at scale
- `RESEND_API_KEY` must be set in Convex dashboard environment variables (not .env.local — runs in Convex Node.js runtime)
- Email failures are caught and logged, never block in-app notification delivery
- Pending user profiles expire after 30 days (must be re-created by admin if unclaimed)
- Messaging enforces relationship boundaries (non-admins can only message admins or users sharing a loan; deactivated users cannot be messaged)
- Cross-field loan validation enforced: loanAmount <= purchasePrice, drawFundsUsed <= drawFundsTotal
- Draw amount validation includes pending/under_review draws when computing available funds
- File uploads validated client-side: 10MB max, restricted file types (PDF, images, Office docs)
- Payments only allowed on funded/sent_to_title/closed loans; Record Payment button hidden on other statuses
- Missed payments allow $0 amount; missed payments excluded from totalReceived/totalRevenue
- Payment stats include partial payment count; on-time % consistently uses explicit on_time count / total across all reports
- Closing statement replace deletes old file from storage (no orphans)
- Email notifications skip deactivated users
- markAllRead loops in batches (handles 200+ unread)
- Payment stats computed client-side from payments data (eliminates duplicate getPaymentStats query)
- Admin error handling still uses `alert()` in several pages (future: replace with toast component)
- Activity log `getRecentActivity` returns latest 100 entries (limit capped at 500); `getActivityForEntity` scans 500 — may need pagination at scale
- Developer role has identical permissions to admin; differentiation is organizational only

## Convex File Upload Pattern

Used in `FileUploadDialog` component and closing statement upload:
1. Client-side validation: file type (`accept` attribute) + 10MB size limit
2. Call `documents.generateUploadUrl` mutation → get signed URL
3. `fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file })`
4. Check `result.ok` before parsing response
5. Extract `storageId` from response JSON
6. Call `documents.saveDocument` mutation with `{ fileId: storageId, fileName, fileSize, type, loanId? }`
   — OR for closing statements: `admin.attachClosingStatement` with `{ loanId, fileId: storageId }`
