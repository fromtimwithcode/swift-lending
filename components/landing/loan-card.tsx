"use client";

import { motion } from "framer-motion";

export function LoanCard() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mx-auto max-w-md px-6"
      >
        {/* Main card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-black/[0.08]">
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
    </section>
  );
}
