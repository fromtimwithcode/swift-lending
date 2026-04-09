"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface EmailStepProps {
  onSubmit: (email: string) => void;
  isSending: boolean;
}

export function EmailStep({ onSubmit, isSending }: EmailStepProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) onSubmit(email.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="login-email" className="sr-only">
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby="email-hint"
          disabled={isSending}
          className="w-full rounded-xl border border-white/10 bg-teal-dark/40 px-4 py-3.5 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] placeholder:text-white/40 outline-none transition-all duration-200 focus:border-white/25 focus:bg-teal-dark/50 disabled:opacity-50"
        />
        <p id="email-hint" className="sr-only">
          We&apos;ll send a one-time code to this address.
        </p>
      </div>

      <motion.button
        type="submit"
        disabled={isSending || !email.trim()}
        whileHover={!isSending ? { scale: 1.01 } : undefined}
        whileTap={!isSending ? { scale: 0.98 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative overflow-hidden rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-teal transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 cursor-pointer"
      >
        {!isSending && <span className="shimmer-bar" />}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isSending ? (
            <>
              <svg
                className="size-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z"
                />
              </svg>
              Sending code...
            </>
          ) : (
            "Continue with Email"
          )}
        </span>
      </motion.button>
    </form>
  );
}
