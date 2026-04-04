"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="noise-overlay relative overflow-hidden py-32 lg:py-40">
      {/* Teal animated gradient mesh background */}
      <div className="absolute inset-0 bg-teal" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal via-teal to-[#0a1540]" />

      {/* Animated mesh orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-gradient-mesh absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-lime/15 via-teal-light/10 to-transparent blur-[140px]" />
        <div className="animate-gradient-mesh absolute -bottom-40 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-teal-light/10 via-lime/5 to-transparent blur-[120px]" />
        {/* Centered lime glow orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-lime/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Ready to Fund Your{" "}
            <span className="text-lime">Next Deal</span>?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
            Get pre-approved in minutes. Our team is standing by to help you
            close faster than you thought possible.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button className="h-14 rounded-full bg-lime px-10 text-base font-semibold text-teal hover:bg-lime/90 transition-shadow duration-300 hover:shadow-[0_0_24px_oklch(0.80_0.15_264/40%)]">
              Get Started Now
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-full border-white/20 bg-white/10 backdrop-blur-sm px-10 text-base font-semibold text-white hover:bg-white/20 hover:text-white"
            >
              Schedule a Call
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
