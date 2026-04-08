"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Call02Icon,
  Location01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease },
  }),
};

const contactItems = [
  { icon: Call02Icon, label: "(262) 264-8606" },
  { icon: Location01Icon, label: "Milwaukee, WI" },
  { icon: Clock01Icon, label: "Mon–Fri, 9–5 CST" },
];

const serviceOptions = [
  "Bridge Loans",
  "Fix & Flip",
  "Construction",
  "DSCR Rental",
];

const faqs = [
  {
    q: "What is hard money lending?",
    a: "Hard money loans are short-term, asset-based loans secured by real estate. Unlike traditional bank financing, approval is based primarily on the property's value rather than your credit score or income history.",
  },
  {
    q: "How fast can I close on a loan?",
    a: "Most deals close within 7–14 days. For experienced borrowers with clean files, we've closed in as few as 5 business days. Speed depends on property type, title work, and appraisal turnaround.",
  },
  {
    q: "What types of properties do you finance?",
    a: "We fund single-family, multi-family (2–4 units), mixed-use, and small commercial properties across Wisconsin. Fix-and-flip, ground-up construction, bridge, and DSCR rental loans are all available.",
  },
  {
    q: "What are typical loan terms and rates?",
    a: "Bridge and fix-and-flip loans typically run 6–18 months with interest rates starting at 9.99%. DSCR rental loans offer 30-year terms with rates starting at 7.5%. Every deal is different — reach out for a custom quote.",
  },
  {
    q: "Do I need perfect credit to qualify?",
    a: "No. We focus on the deal, not the borrower. While we do review credit, our primary underwriting criteria is the property's after-repair value (ARV) and your project plan. Scores as low as 620 can qualify.",
  },
];

const inputClasses =
  "w-full rounded-xl border border-white/10 bg-teal-dark/40 px-4 py-3.5 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] placeholder:text-white/40 outline-none transition-all duration-200 focus:border-white/25 focus:bg-teal-dark/50";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full rounded-2xl border border-gray-200 px-6 py-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50/50"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-base font-medium text-gray-900">{q}</span>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1v12M1 7h12" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <p className="pt-3 text-sm leading-relaxed text-gray-500">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

export function CTASection() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden py-24 lg:py-32"
    >
      <div className="relative mx-auto max-w-7xl px-6">
        {/* ── Contact Form Panel ── */}
        <div className="relative overflow-hidden rounded-3xl bg-teal p-8 sm:p-12 lg:p-16">
          {/* Single subtle lighter wash — top right */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-[500px] w-[500px] rounded-full bg-teal-light/10 blur-[140px]" />

          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            {/* ── Left column — Form ── */}
            <div>
              <motion.h2
                className="text-4xl font-bold tracking-tight sm:text-5xl"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={0}
              >
                <span className="font-normal text-white/70">Fund Your </span>
                <span className="text-white">Next Deal</span>
              </motion.h2>

              <motion.p
                className="mt-5 max-w-md text-base leading-relaxed text-white/60"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={1}
              >
                Fill out the form below and our team will reach out within 24
                hours.
              </motion.p>

              <motion.form
                className="mt-10 space-y-3.5"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={2}
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Full Name"
                    className={inputClasses}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className={inputClasses}
                    required
                  />
                </div>

                <input
                  type="tel"
                  placeholder="Phone Number"
                  className={inputClasses}
                />

                <div className="relative">
                  <select
                    className={`${inputClasses} appearance-none pr-10`}
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Select a Service
                    </option>
                    {serviceOptions.map((s) => (
                      <option key={s} value={s} className="bg-teal-dark text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                <textarea
                  rows={4}
                  placeholder="Tell us about your deal..."
                  className={`${inputClasses} resize-none`}
                />

                <button
                  type="submit"
                  className="w-full rounded-full bg-white py-4 text-base font-semibold text-teal transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(255,255,255,0.12)] active:scale-[0.99]"
                >
                  Get Started
                </button>
              </motion.form>
            </div>

            {/* ── Right column — Photo + Floating Card ── */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Photo with ambient glow */}
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-white/[0.06] blur-2xl" />
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/10 lg:aspect-[4/5]">
                  <Image
                    src="/team.jpg"
                    alt="Swift Capital Lending team"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              </div>

              {/* Floating contact card */}
              <motion.div
                className="absolute -bottom-5 inset-x-3 rounded-2xl border border-white/[0.12] bg-white/[0.08] px-6 py-4 backdrop-blur-2xl sm:inset-x-4"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: 0.3,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {contactItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <HugeiconsIcon
                          icon={item.icon}
                          className="size-4 text-white/70"
                          strokeWidth={1.5}
                        />
                      </div>
                      <span className="whitespace-nowrap text-xs text-white/80 sm:text-sm">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* ── FAQ Section ── */}
        <div className="mt-24 lg:mt-32">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left — Heading */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                FAQ
              </span>
              <h3 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Frequently Asked{" "}
                <span className="text-teal">Questions</span>
              </h3>
              <a
                href="#contact"
                className="mt-8 inline-flex items-center rounded-full bg-lime px-6 py-3 text-sm font-semibold text-teal-dark transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
              >
                Get in Touch
              </a>
            </motion.div>

            {/* Right — Accordion */}
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1, ease }}
            >
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
