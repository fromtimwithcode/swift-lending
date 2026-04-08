"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BadgeDollarSignIcon,
  FlashIcon,
  Building04Icon,
  Agreement02Icon,
} from "@hugeicons/core-free-icons";

const services = [
  {
    icon: BadgeDollarSignIcon,
    title: "Hard Money Loans",
    description: "Fast, flexible funding built for deals that can't wait.",
    image: "/images/services/hard-money-loans.jpg",
  },
  {
    icon: FlashIcon,
    title: "Fix & Flip Financing",
    description: "Close fast. Renovate confidently. Exit profitably.",
    image: "/images/services/fix-and-flip.jpg",
  },
  {
    icon: Building04Icon,
    title: "Rehab & Renovate",
    description: "One loan for purchase and rehab — simple, local, reliable.",
    image: "/images/services/rehab-and-renovate.jpg",
  },
  {
    icon: Agreement02Icon,
    title: "Investor-Friendly",
    description: "Milwaukee-based lending that fits your market.",
    image: "/images/services/investor-friendly.png",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

export function Services() {
  return (
    <SectionWrapper className="bg-white py-24 lg:py-28" id="services">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
            Swift Capital Services
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Hard Money Loans for Wisconsin
            <br className="hidden sm:block" /> Real Estate Investors
          </h2>
        </div>

        {/* Card grid */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          transition={{ staggerChildren: 0.12 }}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {services.map((service) => (
            <motion.div
              key={service.title}
              variants={cardVariants}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg hover:shadow-teal/5"
            >
              {/* Image */}
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 lg:aspect-[3/3.5]">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>

              {/* Icon badge — overlapping image bottom-center */}
              <div className="relative z-10 -mt-6 flex justify-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-teal shadow-sm">
                  <HugeiconsIcon
                    icon={service.icon}
                    className="size-6 text-white"
                  />
                </div>
              </div>

              {/* Text */}
              <h3 className="mt-4 text-center text-lg font-semibold text-gray-900">
                {service.title}
              </h3>
              <p className="mt-1 text-center text-sm text-gray-500">
                {service.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <button className="h-14 cursor-pointer rounded-full bg-teal px-10 font-semibold text-white transition-colors hover:bg-teal-dark">
            View All Services
          </button>
        </div>
      </div>
    </SectionWrapper>
  );
}
