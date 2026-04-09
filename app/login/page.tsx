"use client";

import { LoginCard } from "@/components/auth/login-card";
import { motion } from "framer-motion";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

export default function LoginPage() {
  return (
    <div className="relative w-full min-h-dvh flex items-center justify-center bg-gradient-to-br from-teal via-teal to-[#0a1540] overflow-hidden px-4 py-12">
      {/* Floating gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 h-[60vmax] w-[60vmax] rounded-full bg-teal-light/20 blur-3xl animate-gradient-mesh" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[50vmax] w-[50vmax] rounded-full bg-[#0a1540]/40 blur-3xl animate-gradient-mesh [animation-delay:4s]" />
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay pointer-events-none" />

      {/* Content */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-8"
      >
        {/* Logo */}
        <motion.a
          href="/"
          variants={fadeUp}
          className="flex items-center gap-2 text-white"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal">
            <svg
              width="18"
              height="20"
              viewBox="0 0 18 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.5 1L1.5 11.5H9L7.5 19L16.5 8.5H9L10.5 1Z"
                fill="white"
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Swift Capital
          </span>
        </motion.a>

        {/* Card */}
        <motion.div variants={fadeUp} className="w-full">
          <LoginCard />
        </motion.div>

        {/* Footer links */}
        <motion.p
          variants={fadeUp}
          className="text-center text-xs text-white/40"
        >
          By continuing, you agree to our{" "}
          <a href="/terms" className="underline hover:text-white/60 transition-colors">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-white/60 transition-colors">
            Privacy Policy
          </a>
        </motion.p>
      </motion.div>
    </div>
  );
}
