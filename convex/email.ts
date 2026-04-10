"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";

export const sendNotificationEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    recipientEmail: v.string(),
    recipientName: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set — skipping email");
      return;
    }

    try {
      const resend = new Resend(apiKey);
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
              <p style="margin: 0 0 8px;">Hi ${args.recipientName},</p>
              <p style="margin: 0 0 16px;">${args.body}</p>
              <a href="${process.env.SITE_URL ?? "https://swiftcapitallending.com"}/dashboard"
                 style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
                View in Dashboard
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
