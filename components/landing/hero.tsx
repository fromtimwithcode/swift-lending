"use client";

import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";

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
    <section className="relative h-screen overflow-hidden bg-black pt-24">
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-[1] h-full w-full object-cover"
      >
        <source
          src="https://mach1lending.com/wp-content/uploads/2026/01/098883107-drone-shot-milwaukee-wisconsin_H264HD1080.mov"
          type="video/mp4"
        />
      </video>

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

      <div className="relative z-[3] flex h-full w-full items-center justify-center mx-auto max-w-7xl px-6">
        {/* Centered content */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="mx-auto mt-8 max-w-5xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl"
          >
            Fast Capital for{" "}
            <span className="lg:whitespace-nowrap">Real Estate Investors</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-8 max-w-2xl text-lg text-white/70 lg:text-xl"
          >
            Close in as few as 5 days. Bridge loans, fix &amp; flip financing,
            and commercial lending — with rates and terms that make sense.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <motion.button
              whileHover="hover"
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative flex h-14 items-center gap-2.5 overflow-hidden rounded-full bg-teal px-10 text-base font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <div className="shimmer-bar" />
              <span className="relative">Get Funding Now</span>
              <motion.span
                variants={{ hover: { x: 4 } }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="relative flex"
              >
                <ArrowRight className="size-5" />
              </motion.span>
            </motion.button>
            <motion.button
              whileHover="hover"
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex h-14 items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.08] px-10 text-base text-white backdrop-blur-sm outline-none transition-colors duration-300 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <span>Speak With An Expert</span>
              <motion.span
                variants={{ hover: { x: 3, y: -3 } }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="flex"
              >
                <ArrowUpRight className="size-5" />
              </motion.span>
            </motion.button>
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
                  <div className="mt-1 text-xs text-white/50">{stat.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="h-10 w-px bg-white/20" />
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
