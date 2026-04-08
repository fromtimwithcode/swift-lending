import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
