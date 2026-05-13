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

export const sendLoanApplicationAlert = internalAction({
  args: {
    borrowerName: v.string(),
    propertyAddress: v.string(),
    loanAmount: v.number(),
    loanId: v.id("loans"),
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

    const recipients = alertEmailsRaw.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length === 0) return;

    const loanUrl = `${siteUrl()}/dashboard/admin/loans/${args.loanId}`;

    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "Swift Capital <notifications@swiftcapitallending.com>",
        to: recipients,
        subject: "New Loan Application",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
              <h2 style="color: #fff; margin: 0;">Swift Capital Lending</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h3 style="margin: 0 0 16px;">New Loan Application Submitted</h3>
              <p style="margin: 0 0 8px;"><strong>Borrower:</strong> ${escapeHtml(args.borrowerName)}</p>
              <p style="margin: 0 0 8px;"><strong>Property:</strong> ${escapeHtml(args.propertyAddress)}</p>
              <p style="margin: 0 0 16px;"><strong>Total Loan Amount:</strong> ${args.loanAmount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}</p>
              <a href="${escapeHtml(loanUrl)}"
                 style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
                View Application
              </a>
            </div>
          </div>
        `,
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
      const resend = new Resend(apiKey);
      const actionPath = args.actionPath?.startsWith("/") ? args.actionPath : "/dashboard";
      const actionUrl = `${siteUrl()}${actionPath}`;
      await resend.emails.send({
        from: "Swift Capital <notifications@swiftcapitallending.com>",
        to: args.recipientEmail,
        subject: args.title,
        headers: {
          "X-Entity-Ref-ID": args.notificationId,
        },
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
              <h2 style="color: #fff; margin: 0;">Swift Capital Lending</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px;">Hi ${escapeHtml(args.recipientName)},</p>
              <p style="margin: 0 0 16px;">${escapeHtml(args.body)}</p>
              <a href="${escapeHtml(actionUrl)}"
                  style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
                ${escapeHtml(args.actionLabel ?? "View in Dashboard")}
              </a>
            </div>
          </div>
        `,
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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_FROM_PHONE;

    if (!accountSid || !authToken || !fromPhone) {
      console.warn("Twilio env vars not set — skipping SMS");
      return;
    }

    const message = `${args.title}: ${args.body}`.slice(0, 1500);
    const body = new URLSearchParams({
      To: args.recipientPhone,
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
