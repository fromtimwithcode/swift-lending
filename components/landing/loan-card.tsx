"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/* ── Scroll-reveal text — split into words ── */
const revealText =
  "We fund deals other lenders won't touch. Closing in days, not months. Bridge loans, fix & flip, ground-up construction, and DSCR rentals with rates and terms that make sense.";
const words = revealText.split(" ");

/* ── Floating SVG icons — large, detailed, real-estate themed ── */
const floatingIcons = [
  {
    // House — detailed with chimney, door, windows
    paths: [
      "M3 12l9-8 9 8",
      "M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10",
      "M9 21v-6h6v6",
      "M9 9h1v1H9zM14 9h1v1h-1z",
      "M16 3v3",
    ],
    position: "top-8 left-[3%]",
    size: 220,
    rotate: -12,
    delay: 0,
    duration: 8,
    drift: 16,
  },
  {
    // Dollar sign — bold
    paths: [
      "M12 1v22",
      "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    ],
    position: "top-4 right-[4%]",
    size: 180,
    rotate: 15,
    delay: 1.2,
    duration: 7,
    drift: 14,
  },
  {
    // Key — detailed
    paths: [
      "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
      "M8.5 16.5l-1 1",
    ],
    position: "bottom-8 left-[2%]",
    size: 200,
    rotate: 25,
    delay: 0.6,
    duration: 9,
    drift: 18,
  },
  {
    // Chart — trending up with grid lines
    paths: [
      "M1 22h22",
      "M1 18h22",
      "M1 14h22",
      "M1 10h22",
      "M4 18l4-4 4 2 4-6 4-2",
      "M4 18l4-4 4 2 4-6 4-2",
    ],
    position: "bottom-6 right-[3%]",
    size: 190,
    rotate: -8,
    delay: 1.8,
    duration: 7.5,
    drift: 15,
  },
  {
    // Building — tall with floors
    paths: [
      "M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18",
      "M6 22H3M18 22h3",
      "M10 6h4M10 10h4M10 14h4M10 18h4",
      "M6 8h-2M6 12h-2M6 16h-2",
      "M18 8h2M18 12h2M18 16h2",
    ],
    position: "top-[40%] left-[1%]",
    size: 160,
    rotate: 6,
    delay: 2.2,
    duration: 8.5,
    drift: 12,
  },
  {
    // Percent — large
    paths: [
      "M19 5L5 19",
      "M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
      "M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
    ],
    position: "top-[38%] right-[2%]",
    size: 150,
    rotate: -18,
    delay: 0.9,
    duration: 7.8,
    drift: 13,
  },
];

function RevealWord({
  word,
  index,
  total,
  scrollYProgress,
}: {
  word: string;
  index: number;
  total: number;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const start = index / total;
  const end = (index + 1) / total;
  const opacity = useTransform(scrollYProgress, [start, end], [0.15, 1]);
  const color = useTransform(
    scrollYProgress,
    [start, end],
    ["oklch(0.55 0 0)", "oklch(0.13 0 0)"]
  );

  return (
    <motion.span style={{ opacity, color }} className="transition-none">
      {word}{" "}
    </motion.span>
  );
}

export function LoanCard() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.8", "start 0.35"],
  });

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center justify-center gap-16 overflow-hidden bg-blue-50 pb-28 pt-14 lg:min-h-[calc(100dvh-4rem)] lg:pb-36 lg:pt-20"
    >
      {/* Floating icons */}
      {floatingIcons.map((icon, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: icon.delay * 0.3, ease: "easeOut" }}
          className={`pointer-events-none absolute hidden xl:block ${icon.position}`}
        >
          <motion.svg
            width={icon.size}
            height={icon.size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={`url(#icon-gradient-${i})`}
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ rotate: icon.rotate }}
            animate={{
              y: [0, -icon.drift, 0],
              rotate: [icon.rotate, icon.rotate + 4, icon.rotate],
            }}
            transition={{
              duration: icon.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: icon.delay,
            }}
          >
            <defs>
              <linearGradient id={`icon-gradient-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.45 0.24 264)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="oklch(0.80 0.15 264)" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            {icon.paths.map((d, j) => (
              <path key={j} d={d} />
            ))}
          </motion.svg>
        </motion.div>
      ))}

      {/* Scroll-linked text reveal */}
      <p className="relative mx-auto max-w-5xl px-6 text-center text-2xl font-semibold leading-loose tracking-tight sm:text-3xl lg:text-[2.5rem] lg:leading-[1.6]">
        {words.map((word, i) => (
          <RevealWord
            key={i}
            word={word}
            index={i}
            total={words.length}
            scrollYProgress={scrollYProgress}
          />
        ))}
      </p>

      {/* Loan card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mx-auto w-full max-w-lg px-8 sm:px-12"
      >
        {/* Main card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-black/[0.08]">
          <div className="flex items-center gap-3 sm:justify-between">
            <span className="text-sm text-gray-400">Loan Summary</span>
            <span className="rounded-full bg-lime/30 px-3 py-1 text-xs font-medium text-teal">
              Pre-Approved
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900">$425,000</div>
            <div className="text-sm text-gray-400">Bridge Loan</div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {[
              { label: "Rate", value: "9.5%" },
              { label: "Term", value: "12 mo" },
              { label: "LTV", value: "85%" },
              { label: "Close", value: "5 days" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-gray-50 p-3 text-center"
              >
                <div className="text-xs text-gray-400">{item.label}</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating badge — top right */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-4 right-0 sm:-right-4 rounded-xl bg-white/90 backdrop-blur-sm p-3 shadow-xl shadow-black/[0.08]"
        >
          <div className="text-xs text-gray-400">Funded Today</div>
          <div className="text-lg font-bold text-teal">$1.2M</div>
        </motion.div>

        {/* Floating badge — bottom left */}
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-4 left-0 sm:-left-4 rounded-xl bg-white/90 backdrop-blur-sm p-3 shadow-xl shadow-black/[0.08]"
        >
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-lime" />
            <span className="text-xs text-gray-500">Processing</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            12 Active Loans
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
