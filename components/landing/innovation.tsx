"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const stats = [
  { value: 200, suffix: "M+", prefix: "$", label: "Loans Funded" },
  { value: 500, suffix: "+", prefix: "", label: "Deals Closed" },
  { value: 48, suffix: "", prefix: "", label: "States Covered" },
  { value: 4.9, suffix: "★", prefix: "", label: "Client Rating" },
];

function Counter({
  value,
  suffix,
  prefix,
  isFloat,
}: {
  value: number;
  suffix: string;
  prefix: string;
  isFloat: boolean;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * value);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {prefix}
      {isFloat ? count.toFixed(1) : Math.floor(count)}
      {suffix}
    </span>
  );
}

export function Innovation() {
  return (
    <section className="noise-overlay relative overflow-hidden py-32" id="about">
      {/* Teal background */}
      <div className="absolute inset-0 bg-teal" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal via-teal to-[#0a1540]" />

      {/* Animated gradient mesh overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-gradient-mesh absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-lime/15 via-teal-light/10 to-transparent blur-[140px]" />
        <div className="animate-gradient-mesh absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-teal-light/10 via-lime/5 to-transparent blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-lime">
            Our Track Record
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Proven Results, <span className="text-lime">Nationwide</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            We&apos;ve built our reputation on speed, reliability, and
            transparent lending. The numbers speak for themselves.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          transition={{ staggerChildren: 0.1 }}
          className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.5 }}
              whileHover={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              className="rounded-2xl border border-white/15 bg-white/[0.07] p-8 text-center backdrop-blur-md transition-colors"
            >
              <div className="text-4xl font-bold text-lime sm:text-5xl">
                <Counter
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                  isFloat={stat.value % 1 !== 0}
                />
              </div>
              <div className="mt-2 text-sm text-white/70">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
