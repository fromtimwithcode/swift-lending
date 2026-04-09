"use client";

import { useRef, useCallback, useEffect } from "react";

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusIndex = useCallback((i: number) => {
    refs.current[i]?.focus();
  }, []);

  // Focus first empty box on mount
  useEffect(() => {
    const firstEmpty = value.findIndex((v) => !v);
    focusIndex(firstEmpty === -1 ? 0 : firstEmpty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (i: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) focusIndex(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      const next = [...value];
      next[i - 1] = "";
      onChange(next);
      focusIndex(i - 1);
    }
    if (e.key === "ArrowLeft" && i > 0) focusIndex(i - 1);
    if (e.key === "ArrowRight" && i < 5) focusIndex(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    onChange(next);
    focusIndex(Math.min(pasted.length, 5));
  };

  return (
    <div
      role="group"
      aria-label="One-time verification code"
      className="flex justify-center gap-2 sm:gap-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1} of 6`}
          value={value[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="size-12 sm:size-14 rounded-xl border border-white/10 bg-teal-dark/40 text-center text-xl font-semibold text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] outline-none transition-all duration-200 focus:border-lime/60 focus:ring-2 focus:ring-lime/20 focus:bg-teal-dark/50 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
