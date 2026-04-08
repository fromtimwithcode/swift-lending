"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";

const steps = [
  { step: "01", label: "Apply Online", width: "100%" },
  { step: "02", label: "Get Approved", width: "65%" },
  { step: "03", label: "Close & Fund", width: "30%" },
];

export function SimpleFast() {
  return (
    <SectionWrapper className="bg-white py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Row 1 — Process */}
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-20">
          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1"
          >
            <div className="rounded-2xl border border-gray-100 bg-[#FAFAFA] p-8">
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={s.step}>
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
                          i === 0
                            ? "bg-teal text-white shadow-lg shadow-teal/20"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {s.step}
                      </div>
                      <div className="flex-1">
                        <div className="text-gray-900 font-medium">{s.label}</div>
                        <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-teal to-lime"
                            initial={{ width: 0 }}
                            whileInView={{ width: s.width }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.3 + i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Connecting line between steps */}
                    {i < steps.length - 1 && (
                      <div className="ml-7 flex justify-start">
                        <div className="h-6 w-px bg-gray-200" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex-1"
          >
            <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
              Simple Process
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              From Application to{" "}
              <span className="text-teal">Funding</span> in Days
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-500">
              Our streamlined process means less paperwork and faster closings.
              Apply online in minutes, get a term sheet within 24 hours, and
              close in as few as 5 business days.
            </p>
          </motion.div>
        </div>

        {/* Row 2 — Speed (reversed) */}
        <div className="mt-24 flex flex-col-reverse items-center gap-12 lg:flex-row lg:gap-20">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1"
          >
            <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
              Speed Matters
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Never Miss a <span className="text-teal">Deal</span> Again
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-500">
              In real estate, timing is everything. Our capital is ready when you
              are — with in-house underwriting, direct lending, and no red tape
              slowing you down.
            </p>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex-1"
          >
            <div className="rounded-2xl border border-gray-100 bg-[#FAFAFA] p-8">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Avg Close Time", value: "7 Days", highlight: true },
                  { label: "Approval Rate", value: "85%", highlight: false },
                  { label: "Repeat Clients", value: "73%", highlight: false },
                  { label: "Term Sheets", value: "24 hrs", highlight: true },
                ].map((item) => (
                  <motion.div
                    key={item.label}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={`rounded-2xl p-5 text-center transition-shadow ${
                      item.highlight
                        ? "bg-gradient-to-br from-teal/5 to-lime/10 border border-teal/10"
                        : "bg-white"
                    }`}
                  >
                    <div
                      className={`text-2xl font-bold ${item.highlight ? "text-gradient-teal" : "text-gray-900"}`}
                    >
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {item.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}
