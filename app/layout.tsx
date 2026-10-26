import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Only the admin dashboard uses DM Sans, so other routes skip the preload.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Swift Capital Lending | Hard Money Loans Made Simple",
  description:
    "Fast, flexible hard money lending for Wisconsin real estate investors. Fix & flip and BRRRR strategy loans, closing in days, not months.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`h-full antialiased ${jakarta.variable} ${dmSans.variable}`} suppressHydrationWarning>
        <body className="relative min-h-full flex flex-col">
          <NextTopLoader
            color="oklch(0.76 0.14 80)"
            height={2}
            showSpinner={false}
            shadow={false}
          />
          <ConvexClientProvider>
            <ThemeProvider>
              {children}
              <Toaster
                style={{ zIndex: 55 }}
                position="bottom-right"
                closeButton
                toastOptions={{
                  style: {
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  },
                }}
              />
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
