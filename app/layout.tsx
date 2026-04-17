import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Swift Capital Lending | Hard Money Loans Made Simple",
  description:
    "Fast, flexible hard money lending for real estate investors. Bridge loans, fix & flip financing, and commercial lending. Close in as few as 5 days.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`h-full antialiased ${jakarta.variable}`} suppressHydrationWarning>
        <body className="relative min-h-full flex flex-col">
          <NextTopLoader
            color="oklch(0.80 0.15 264)"
            height={2}
            showSpinner={false}
            shadow={false}
          />
          <ConvexClientProvider>
            <ThemeProvider>
              {children}
              <Toaster
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
