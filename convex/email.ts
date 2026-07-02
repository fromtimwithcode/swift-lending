"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";

/** Escape HTML entities to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteUrl() {
  return (process.env.SITE_URL ?? "https://swiftcapitallending.com").replace(/\/+$/, "");
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function optionalText(value: string | undefined): string {
  return value?.trim() || "Not provided";
}

function optionalCurrency(value: number | undefined): string {
  return value === undefined ? "Not provided" : formatCurrency(value);
}

function parseRecipients(raw: string, excludeEmails: string[] = []) {
  const seen = new Set<string>();
  const excluded = new Set(
    excludeEmails
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
  const recipients: string[] = [];
  for (const value of raw.split(",")) {
    const email = value.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key) || excluded.has(key)) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    seen.add(key);
    recipients.push(email);
  }
  return recipients;
}

function detailRows(details: { label: string; value: string }[] | undefined) {
  if (!details || details.length === 0) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px; border: 1px solid #e5e7eb; border-collapse: collapse;">
      ${details
        .map(
          (detail) => `
            <tr>
              <td width="180" style="background: #f9fafb; padding: 10px 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(detail.label)}</td>
              <td style="padding: 10px 12px; color: #111827; border-bottom: 1px solid #e5e7eb;">${escapeHtml(detail.value)}</td>
            </tr>
          `
        )
        .join("")}
    </table>
  `;
}

function brandedEmailHtml(args: {
  title: string;
  greeting?: string;
  body: string;
  details?: { label: string; value: string }[];
  actionUrl?: string;
  actionLabel?: string;
}) {
  const actionHtml = args.actionUrl
    ? `
      <a href="${escapeHtml(args.actionUrl)}"
         style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
        ${escapeHtml(args.actionLabel ?? "View in Dashboard")}
      </a>
    `
    : "";

  return `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #fff; margin: 0;">Swift Capital Lending</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h3 style="margin: 0 0 16px;">${escapeHtml(args.title)}</h3>
        ${args.greeting ? `<p style="margin: 0 0 8px;">Hi ${escapeHtml(args.greeting)},</p>` : ""}
        <p style="margin: 0 0 16px; line-height: 1.5;">${escapeHtml(args.body).replace(/\n/g, "<br />")}</p>
        ${detailRows(args.details)}
        ${actionHtml}
      </div>
    </div>
  `;
}

async function sendWithResend(args: {
  apiKey: string;
  to: string | string[];
  subject: string;
  html: string;
  headers?: Record<string, string>;
}) {
  const resend = new Resend(args.apiKey);
  await resend.emails.send({
    from: "Swift Capital <notifications@mail.swiftcapitallending.com>",
    to: args.to,
    subject: args.subject,
    headers: args.headers,
    html: args.html,
  });
}

export const sendTeamAlertEmail = internalAction({
  args: {
    title: v.string(),
    body: v.string(),
    details: v.optional(v.array(v.object({ label: v.string(), value: v.string() }))),
    actionPath: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    excludeEmails: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set — skipping team alert email");
      return;
    }

    const alertEmailsRaw = process.env.LOAN_ALERT_EMAILS;
    if (!alertEmailsRaw) {
      console.warn("LOAN_ALERT_EMAILS not set — skipping team alert email");
      return;
    }

    const recipients = parseRecipients(alertEmailsRaw, args.excludeEmails);
    if (recipients.length === 0) {
      console.warn("LOAN_ALERT_EMAILS has no valid recipients — skipping team alert email");
      return;
    }

    try {
      const actionPath = args.actionPath?.startsWith("/") ? args.actionPath : "/dashboard";
      await sendWithResend({
        apiKey,
        to: recipients,
        subject: args.title,
        html: brandedEmailHtml({
          title: args.title,
          body: args.body,
          details: args.details,
          actionUrl: `${siteUrl()}${actionPath}`,
          actionLabel: args.actionLabel ?? "View Details",
        }),
      });
    } catch (error) {
      console.error("Failed to send team alert email:", error);
    }
  },
});

export const sendLoanApplicationAlert = internalAction({
  args: {
    borrowerName: v.string(),
    propertyAddress: v.string(),
    purchasePrice: v.number(),
    rehabBudgetTotal: v.number(),
    afterRepairValue: v.optional(v.number()),
    desiredCloseDate: v.optional(v.string()),
    titleCompany: v.optional(v.string()),
    loanAmount: v.number(),
    loanId: v.id("loans"),
    excludeEmails: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set — skipping loan application alert email");
      return;
    }

    const alertEmailsRaw = process.env.LOAN_ALERT_EMAILS;
    if (!alertEmailsRaw) {
      console.warn("LOAN_ALERT_EMAILS not set — skipping loan application alert email");
      return;
    }

    const recipients = parseRecipients(alertEmailsRaw, args.excludeEmails);
    if (recipients.length === 0) {
      console.warn("LOAN_ALERT_EMAILS has no valid recipients — skipping loan application alert email");
      return;
    }

    const loanUrl = `${siteUrl()}/dashboard/admin/loans/${args.loanId}`;

    try {
      await sendWithResend({
        apiKey,
        to: recipients,
        subject: "New Loan Application Submitted",
        html: brandedEmailHtml({
          title: "New Loan Application Submitted",
          body: `${args.borrowerName} submitted a new loan application for ${args.propertyAddress}.`,
          details: [
            { label: "Borrower", value: args.borrowerName },
            { label: "Property address", value: args.propertyAddress },
            { label: "Purchase price", value: formatCurrency(args.purchasePrice) },
            { label: "Rehab amount", value: formatCurrency(args.rehabBudgetTotal) },
            { label: "ARV", value: optionalCurrency(args.afterRepairValue) },
            { label: "Total loan amount", value: formatCurrency(args.loanAmount) },
            { label: "Desired close date", value: optionalText(args.desiredCloseDate) },
            { label: "Title company", value: optionalText(args.titleCompany) },
          ],
          actionUrl: loanUrl,
          actionLabel: "View Application",
        }),
      });
    } catch (error) {
      console.error("Failed to send loan application alert email:", error);
    }
  },
});

export const sendNotificationEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    recipientEmail: v.string(),
    recipientName: v.string(),
    title: v.string(),
    body: v.string(),
    actionPath: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set — skipping email");
      return;
    }

    try {
      const actionPath = args.actionPath?.startsWith("/") ? args.actionPath : "/dashboard";
      const actionUrl = `${siteUrl()}${actionPath}`;
      await sendWithResend({
        apiKey,
        to: args.recipientEmail,
        subject: args.title,
        headers: {
          "X-Entity-Ref-ID": args.notificationId,
        },
        html: brandedEmailHtml({
          title: args.title,
          greeting: args.recipientName,
          body: args.body,
          actionUrl,
          actionLabel: args.actionLabel ?? "View in Dashboard",
        }),
      });

      await ctx.runMutation(internal.notifications.markEmailSent, {
        id: args.notificationId,
      });
    } catch (error) {
      console.error("Failed to send notification email:", error);
    }
  },
});

export const sendNotificationSms = internalAction({
  args: {
    recipientPhone: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    const recipientPhone = args.recipientPhone.trim();
    if (!recipientPhone) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_FROM_PHONE;

    if (!accountSid || !authToken || !fromPhone) {
      console.warn("Twilio env vars not set — skipping SMS");
      return;
    }

    const message = `${args.title}: ${args.body}`.slice(0, 1500);
    const body = new URLSearchParams({
      To: recipientPhone,
      From: fromPhone,
      Body: message,
    });

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }
      );

      if (!response.ok) {
        console.error("Failed to send notification SMS:", await response.text());
      }
    } catch (error) {
      console.error("Failed to send notification SMS:", error);
    }
  },
});
