"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#FAFAFA] pt-24">
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-gradient-mesh absolute -top-60 -right-60 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-lime/25 via-teal/10 to-transparent blur-[140px]" />
        <div className="animate-gradient-mesh absolute -bottom-60 -left-60 h-[700px] w-[700px] rounded-full bg-gradient-to-tr from-teal/15 via-lime/10 to-transparent blur-[120px]" />
        <div className="animate-gradient-mesh absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-lime/10 to-teal/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:py-40">
        {/* Centered content */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-block rounded-full border border-teal/20 bg-teal/10 px-4 py-1.5 text-xs font-medium text-teal">
              Trusted by 500+ Real Estate Investors
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mx-auto mt-8 max-w-5xl text-5xl font-bold leading-[1.08] tracking-tight text-gray-900 sm:text-6xl md:text-7xl lg:text-8xl"
          >
            Fast Capital for{" "}
            <span className="text-gradient-teal">Real Estate</span>{" "}
            Investors
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-8 max-w-2xl text-lg text-gray-500 lg:text-xl"
          >
            Close in as few as 5 days. Bridge loans, fix &amp; flip financing,
            and commercial lending — with rates and terms that make sense.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button className="h-14 rounded-full bg-teal px-10 text-base font-semibold text-white hover:bg-teal/90 transition-shadow duration-300 hover:shadow-[0_0_24px_oklch(0.33_0.05_170/30%)]">
              Apply Now
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-full border-gray-200 px-10 text-base text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              View Loan Programs
            </Button>
          </motion.div>

          {/* Stats row with vertical dividers */}
          <motion.div
            variants={fadeUp}
            className="mt-14 flex items-center justify-center gap-8 sm:gap-12"
          >
            {[
              { value: "5 Day", label: "Closings" },
              { value: "90%", label: "LTV" },
              { value: "4.9★", label: "Rating" },
            ].map((stat, i, arr) => (
              <div key={stat.label} className="flex items-center gap-8 sm:gap-12">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gradient-teal sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{stat.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="h-10 w-px bg-gray-200" />
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Loan card — centered below headline */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative mx-auto mt-16 max-w-md lg:mt-20"
        >
          {/* Main card */}
          <div className="rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-sm p-6 shadow-xl shadow-black/[0.08]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Loan Summary</span>
              <span className="rounded-full bg-lime/30 px-3 py-1 text-xs font-medium text-teal">
                Pre-Approved
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-gray-900">$425,000</div>
              <div className="text-sm text-gray-400">Bridge Loan</div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                { label: "Rate", value: "9.5%" },
                { label: "Term", value: "12 mo" },
                { label: "LTV", value: "85%" },
                { label: "Close", value: "5 days" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg bg-gray-50 p-3 text-center"
                >
                  <div className="text-xs text-gray-400">{item.label}</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating badge — top right */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-4 -right-4 rounded-xl bg-white/90 backdrop-blur-sm p-3 shadow-xl shadow-black/[0.08]"
          >
            <div className="text-xs text-gray-400">Funded Today</div>
            <div className="text-lg font-bold text-teal">$1.2M</div>
          </motion.div>

          {/* Floating badge — bottom left */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -bottom-4 -left-4 rounded-xl bg-white/90 backdrop-blur-sm p-3 shadow-xl shadow-black/[0.08]"
          >
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-lime" />
              <span className="text-xs text-gray-500">Processing</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              12 Active Loans
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
