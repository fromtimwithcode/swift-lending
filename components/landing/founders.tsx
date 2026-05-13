"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";

const founders = [
  {
    name: "Founder One",
    role: "Managing Partner",
    bio: "Background and experience placeholder. Real estate investing expertise, local market knowledge, and lending background.",
    image: null,
  },
  {
    name: "Founder Two",
    role: "Managing Partner",
    bio: "Background and experience placeholder. Real estate investing expertise, local market knowledge, and lending background.",
    image: null,
  },
  {
    name: "Founder Three",
    role: "Managing Partner",
    bio: "Background and experience placeholder. Real estate investing expertise, local market knowledge, and lending background.",
    image: null,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

export function Founders() {
  return (
    <SectionWrapper className="bg-[#FAFAFA] py-24 lg:py-28" id="team">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
            Who We Are
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 text-balance sm:text-4xl lg:text-5xl">
            Meet the <span className="text-gradient-gold">Founders</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Three partners with a shared vision: make real estate financing
            faster, simpler, and more accessible for Wisconsin investors.
          </p>
        </div>

        {/* Cards */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          transition={{ staggerChildren: 0.12 }}
          className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {founders.map((founder) => (
            <motion.div
              key={founder.name}
              variants={cardVariants}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-[border-color,box-shadow] hover:shadow-lg hover:shadow-lime/10 hover:border-lime/30"
            >
              {/* Photo placeholder */}
              <div className="relative mx-auto flex size-32 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                {founder.image ? (
                  <img
                    src={founder.image}
                    alt={founder.name}
                    className="image-outline size-full object-cover"
                  />
                ) : (
                  <svg
                    className="size-16 text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="mt-5 text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {founder.name}
                </h3>
                <p className="mt-0.5 text-sm font-medium text-teal">
                  {founder.role}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500 text-pretty">
                  {founder.bio}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
