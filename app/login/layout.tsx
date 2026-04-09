import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | Swift Capital Lending",
  description: "Sign in to your Swift Capital Lending account.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      {children}
    </div>
  );
}
