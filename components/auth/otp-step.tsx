"use client";

import { useState, useEffect, useCallback } from "react";
import { OtpInput } from "./otp-input";

interface OtpStepProps {
  email: string;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  isVerifying: boolean;
}

export function OtpStep({
  email,
  onVerify,
  onResend,
  onBack,
  isVerifying,
}: OtpStepProps) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(30);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // Auto-submit when all 6 digits filled
  const handleChange = useCallback(
    (next: string[]) => {
      setDigits(next);
      if (next.every((d) => d) && !isVerifying) {
        onVerify(next.join(""));
      }
    },
    [isVerifying, onVerify],
  );

  const handleResend = () => {
    setCountdown(30);
    setDigits(["", "", "", "", "", ""]);
    onResend();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        disabled={isVerifying}
        className="self-start flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 rounded disabled:opacity-50 cursor-pointer"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0"
        >
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Check your email</h2>
        <p className="mt-2 text-sm text-white/50">
          We sent a 6-digit code to{" "}
          <span className="text-white/80 font-medium">{email}</span>
        </p>
      </div>

      {/* OTP Input */}
      <OtpInput value={digits} onChange={handleChange} disabled={isVerifying} />

      {/* Verifying spinner */}
      {isVerifying && (
        <div className="flex items-center gap-2 text-sm text-white/60">
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
          Verifying...
        </div>
      )}

      {/* Resend */}
      {!isVerifying && (
        <p className="text-sm text-white/40">
          {countdown > 0 ? (
            <>
              Resend code in{" "}
              <span className="tabular-nums text-white/60">
                {countdown}s
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-white/60 underline hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40 rounded cursor-pointer"
            >
              Resend code
            </button>
          )}
        </p>
      )}
    </div>
  );
}
