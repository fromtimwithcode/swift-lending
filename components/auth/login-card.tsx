"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { OAuthButton } from "./oauth-button";
import { EmailStep } from "./email-step";
import { OtpStep } from "./otp-step";

type View = "idle" | "sending" | "otp" | "verifying" | "success";

const slideVariants = {
  enterRight: { x: 40, opacity: 0 },
  enterLeft: { x: -40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitLeft: { x: -40, opacity: 0 },
  exitRight: { x: 40, opacity: 0 },
};

const transition = {
  duration: 0.3,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
};

export function LoginCard() {
  const { signIn, signOut } = useAuthActions();
  const [view, setView] = useState<View>("idle");
  const [email, setEmail] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const signingIn = useRef(false);

  // Clear stale auth state on mount. If the user reached /login, the
  // middleware already confirmed they're unauthenticated — any tokens
  // lingering in localStorage are stale and will cause 400s on background
  // refresh attempts. signOut() ignores server errors and always clears
  // local storage, preventing the stale-refresh-token 400 loop.
  useEffect(() => {
    void signOut();
  }, [signOut]);

  const handleOAuth = useCallback(
    async (provider: "google") => {
      if (signingIn.current) return;
      signingIn.current = true;
      setOauthLoading(true);

      try {
        await signIn(provider);
      } catch {
        // First attempt can fail if stale cookies weren't fully cleared yet.
        // The proxy clears them on failure, so one retry is safe.
        try {
          await signIn(provider);
        } catch {
          signingIn.current = false;
          setOauthLoading(false);
        }
      }
    },
    [signIn],
  );

  const handleEmailSubmit = useCallback((submittedEmail: string) => {
    setEmail(submittedEmail);
    setView("sending");
    // TODO: Wire to Convex email OTP provider when added
    setTimeout(() => setView("otp"), 1500);
  }, []);

  const handleVerify = useCallback(() => {
    setView("verifying");
    // TODO: Wire to Convex email OTP verification when added
    setTimeout(() => setView("success"), 1800);
  }, []);

  const handleResend = useCallback(() => {
    // TODO: Wire to Convex email OTP resend when added
  }, []);

  const handleBack = useCallback(() => {
    setView("idle");
  }, []);

  const isOtpView = view === "otp" || view === "verifying";
  const isIdle = view === "idle" || view === "sending";

  return (
    <div className="relative rounded-2xl border border-white/[0.12] bg-white/[0.07] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl overflow-hidden">
      {/* Success overlay */}
      <AnimatePresence>
        {view === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl bg-white/[0.07] backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="flex size-16 items-center justify-center rounded-full bg-lime/20"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                className="text-lime"
              >
                <motion.path
                  d="M8 16.5L13.5 22L24 11"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
                />
              </svg>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-lg font-semibold text-white"
            >
              You&apos;re in!
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card heading */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-white/50">
          Sign in to your account
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isIdle && (
          <motion.div
            key="idle"
            variants={slideVariants}
            initial="center"
            animate="center"
            exit="exitLeft"
            transition={transition}
            className="flex flex-col gap-4"
          >
            {/* OAuth buttons */}
            <div className="flex flex-col gap-3">
              <OAuthButton
                provider="google"
                loading={oauthLoading}
                onClick={() => handleOAuth("google")}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/30 uppercase tracking-wider">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Email form */}
            <EmailStep
              onSubmit={handleEmailSubmit}
              isSending={view === "sending"}
            />
          </motion.div>
        )}

        {isOtpView && (
          <motion.div
            key="otp"
            variants={slideVariants}
            initial="enterRight"
            animate="center"
            exit="exitRight"
            transition={transition}
          >
            <OtpStep
              email={email}
              onVerify={handleVerify}
              onResend={handleResend}
              onBack={handleBack}
              isVerifying={view === "verifying"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
