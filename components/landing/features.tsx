"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Location01Icon,
  Clock01Icon,
  Certificate01Icon,
  SecurityCheckIcon,
  Building04Icon,
  CustomerService01Icon,
} from "@hugeicons/core-free-icons";

const pills = [
  { icon: Location01Icon, label: "Milwaukee Market Expertise" },
  { icon: Clock01Icon, label: "Fast Closings When Speed Matters" },
  { icon: Certificate01Icon, label: "Asset-Based Lending, Not Red Tape" },
  { icon: SecurityCheckIcon, label: "Transparent Terms, No Surprise Fees" },
  { icon: Building04Icon, label: "Built for Real Estate Investors" },
  { icon: CustomerService01Icon, label: "Hands-On, Investor-Friendly Support" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

export function Features() {
  return (
    <SectionWrapper className="bg-[#FAFAFA] py-32" id="programs">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column — Image */}
          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden relative">
              <Image
                src="/team.jpg"
                alt="Swift Lending team"
                fill
                className="object-cover"
              />
            </div>

            {/* Google review badge */}
            <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-100">
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Best Hard Money Lenders</p>
                <p className="text-xs text-gray-500">4.9 Star Customer Rating</p>
              </div>
            </div>
          </div>

          {/* Right column — Content */}
          <div className="flex flex-col justify-center">
            <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
              Why Choose Us
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Our Commitment to Every Deal
            </h2>
            <p className="mt-4 leading-relaxed text-gray-500">
              At Swift Lending, we believe every investor deserves a lending
              partner who&apos;s transparent, responsive, and built for speed. We
              combine institutional-grade underwriting with the flexibility real
              estate investors need — no hidden fees, no surprises, just clear
              terms and fast execution.
            </p>

            <div className="my-8 border-t border-gray-200" />

            <p className="text-base font-medium text-gray-900">
              Hard Money Lending Built for Real Estate Investors
            </p>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              transition={{ staggerChildren: 0.1 }}
              className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {pills.map((pill) => (
                <motion.div
                  key={pill.label}
                  variants={cardVariants}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-xl bg-gray-100 px-5 py-4"
                >
                  <HugeiconsIcon icon={pill.icon} className="size-5 shrink-0 text-teal" />
                  <span className="text-sm font-medium text-gray-700 text-pretty">
                    {pill.label}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
