"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, Setting07Icon, SecurityCheckIcon } from "@hugeicons/core-free-icons";

const features = [
  {
    icon: FlashIcon,
    title: "Fast Closings",
    description:
      "Close in as few as 5 business days. Our streamlined process eliminates bureaucratic delays so you never miss a deal.",
  },
  {
    icon: Setting07Icon,
    title: "Flexible Programs",
    description:
      "Bridge loans, fix & flip, ground-up construction, and DSCR rentals. Tailored structures for every investment strategy.",
  },
  {
    icon: SecurityCheckIcon,
    title: "Transparent Terms",
    description:
      "No hidden fees, no surprises. Clear rate sheets, upfront costs, and dedicated loan officers who answer your calls.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

export function Features() {
  return (
    <SectionWrapper className="bg-[#FAFAFA] py-32" id="programs">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
            Why Choose Us
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Expert Execution, Every Time
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            We combine institutional-grade underwriting with the speed and
            flexibility that real estate investors need.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          transition={{ staggerChildren: 0.12 }}
          className="mt-16 grid gap-8 md:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{ y: -4 }}
              className="gradient-border group rounded-2xl border border-gray-100 bg-white p-10 shadow-sm transition-shadow hover:shadow-lg hover:shadow-teal/5"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal/15 to-lime/20">
                <HugeiconsIcon icon={feature.icon} className="size-6 text-teal" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-3 leading-relaxed text-gray-500">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
