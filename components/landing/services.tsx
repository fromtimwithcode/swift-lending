"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FlashIcon,
  Building04Icon,
} from "@hugeicons/core-free-icons";

const services = [
  {
    icon: FlashIcon,
    title: "Fix & Flip Loans",
    description:
      "Buy it, renovate it, sell it. We provide the capital so you can move quickly on distressed properties with funding in days, not weeks.",
    image: "/images/services/fix-and-flip.jpg",
  },
  {
    icon: Building04Icon,
    title: "BRRRR Strategy Loans",
    description:
      "Buy, rehab, rent, refinance, repeat. Short-term funding to execute the full BRRRR cycle and grow your portfolio.",
    image: "/images/services/rehab-and-renovate.jpg",
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
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 text-balance sm:text-4xl lg:text-5xl">
            Hard Money Loans for Wisconsin
            <br className="hidden sm:block" /> <span className="text-gradient-gold">Real Estate Investors</span>
          </h2>
        </div>

        {/* Card grid */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          transition={{ staggerChildren: 0.12 }}
          className="mt-14 mx-auto grid max-w-5xl gap-8 sm:grid-cols-2"
        >
          {services.map((service) => (
            <motion.div
              key={service.title}
              variants={cardVariants}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-[border-color,box-shadow] hover:shadow-lg hover:shadow-lime/10 hover:border-lime/30"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="image-outline object-cover"
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
              <p className="mt-1 text-center text-sm text-gray-500 text-pretty">
                {service.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <a
            href="#contact"
            className="inline-flex h-14 items-center justify-center rounded-full bg-teal px-10 font-semibold text-white transition-colors hover:bg-teal-dark"
          >
            Get Started
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
}
