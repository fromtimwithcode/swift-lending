"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

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
    transition: { duration: 0.7, ease },
  },
};

export function Hero() {
  const [videoReady, setVideoReady] = useState(false);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black pt-20 md:pt-24">
      {/* Video — fades in as progressive enhancement */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setVideoReady(true)}
        className={`absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-1000 ${videoReady ? "opacity-100" : "opacity-0"}`}
      >
        <source
          src="https://mach1lending.com/wp-content/uploads/2026/01/098883107-drone-shot-milwaukee-wisconsin_H264HD1080.mov"
          type="video/mp4"
        />
      </video>

      {/* Dark gradient overlay — always visible, makes black bg look intentional */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

      <div className="relative z-[3] flex min-h-full w-full items-center justify-center mx-auto max-w-7xl px-6 pb-12">
        {/* Content renders immediately — never waits for video */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="mx-auto mt-4 max-w-5xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-7xl lg:text-8xl"
          >
            Fast Capital for{" "}
            <span className="lg:whitespace-nowrap">Real Estate Investors</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-2xl text-base text-white/70 sm:text-lg lg:text-xl"
          >
            Close in as few as 5 days. Bridge loans, fix &amp; flip financing,
            and commercial lending — with rates and terms that make sense.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-7 flex flex-col items-center justify-center gap-4 sm:mt-10 sm:flex-row"
          >
            <motion.button
              whileHover="hover"
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative flex h-14 w-full sm:w-auto lg:h-16 items-center justify-center gap-2.5 overflow-hidden rounded-full bg-teal px-10 lg:px-12 text-base lg:text-lg font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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
              className="flex h-14 w-full sm:w-auto lg:h-16 items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white/[0.08] px-10 lg:px-12 text-base lg:text-lg text-white backdrop-blur-sm outline-none transition-colors duration-300 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/50"
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

          {/* Social proof + stats glass card */}
          <motion.div
            variants={fadeUp}
            className="mt-8 inline-flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-6 py-4 backdrop-blur-sm sm:mt-14 sm:flex-row sm:gap-6 sm:px-8"
          >
            {/* Avatar stack */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <img
                    key={n}
                    src={`/avatars/${n}.jpg`}
                    alt=""
                    className="size-8 rounded-full border-2 border-white/20 object-cover"
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-white/70">200+ funded</span>
            </div>

            <div className="hidden h-8 w-px bg-white/15 sm:block" />

            {/* Stats */}
            <div className="flex items-center gap-6 sm:gap-8">
              {[
                { value: "5 Day", label: "Closings" },
                { value: "90%", label: "LTV" },
                { value: "4.9★", label: "Rating" },
              ].map((stat, i, arr) => (
                <div key={stat.label} className="flex items-center gap-6 sm:gap-8">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white sm:text-xl">
                      {stat.value}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/50">{stat.label}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="h-8 w-px bg-white/15" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
