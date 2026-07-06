import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Email({
      maxAge: 15 * 60, // 15 minutes
      async generateVerificationToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => (b % 10).toString())
          .join("");
      },
      async sendVerificationRequest({ identifier: email, token }: { identifier: string; token: string }) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          throw new Error("RESEND_API_KEY is not configured");
        }

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Swift Capital <no-reply@mail.swiftcapitallenders.com>",
            to: email,
            subject: "Your sign-in code",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a1a2e; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h2 style="color: #fff; margin: 0;">Swift Capital Lending</h2>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0 0 16px;">Enter the following code to sign in:</p>
                  <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 0 0 16px;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">${token}</span>
                  </div>
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">This code expires in 15 minutes. If you didn&rsquo;t request this, you can safely ignore this email.</p>
                </div>
              </div>
            `,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Failed to send verification email: ${body}`);
        }
      },
    }),
  ],
});
