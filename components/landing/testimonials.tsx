"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";

const testimonials = [
  {
    quote:
      "Swift Capital funded my bridge loan in 6 days. Their team was responsive, transparent, and made the entire process seamless. I've since closed 4 more deals with them.",
    author: "Michael Torres",
    role: "Real Estate Investor, Austin TX",
    rating: 5,
  },
  {
    quote:
      "After getting the runaround from traditional lenders, Swift Capital came through with a competitive rate and closed before my contract deadline. They saved my deal.",
    author: "Sarah Chen",
    role: "Fix & Flip Investor, Miami FL",
    rating: 5,
  },
  {
    quote:
      "I've worked with a dozen hard money lenders over the years. Swift Capital stands out for their speed, professionalism, and genuinely fair terms. They're my go-to now.",
    author: "David Washington",
    role: "Commercial Investor, Phoenix AZ",
    rating: 5,
  },
];

function getInitials(name: string) {
  const parts = name.split(" ");
  return parts.map((p) => p[0]).join("");
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          className="size-4 text-amber-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  const [active, setActive] = useState(0);

  // Auto advance on mobile
  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SectionWrapper className="bg-[#FAFAFA] py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            What Our Clients Say
          </h2>
        </div>

        {/* Desktop: all 3 cards */}
        <div className="mt-16 hidden gap-8 md:grid md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="gradient-border flex flex-col rounded-2xl border border-gray-100 bg-white p-10 shadow-sm transition-shadow hover:shadow-lg hover:shadow-teal/5"
            >
              {/* Decorative quote mark */}
              <div className="text-5xl leading-none text-teal/15 font-serif">
                &ldquo;
              </div>
              <Stars count={t.rating} />
              <p className="mt-4 flex-1 leading-relaxed text-gray-500">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
                {/* Avatar initials */}
                <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-teal to-teal-light text-sm font-bold text-white">
                  {getInitials(t.author)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{t.author}</div>
                  <div className="text-sm text-gray-400">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: carousel */}
        <div className="relative mt-12 md:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="gradient-border rounded-2xl border border-gray-100 bg-white p-10 shadow-sm"
            >
              <div className="text-5xl leading-none text-teal/15 font-serif">
                &ldquo;
              </div>
              <Stars count={testimonials[active].rating} />
              <p className="mt-4 leading-relaxed text-gray-500">
                &ldquo;{testimonials[active].quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-teal to-teal-light text-sm font-bold text-white">
                  {getInitials(testimonials[active].author)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonials[active].author}
                  </div>
                  <div className="text-sm text-gray-400">
                    {testimonials[active].role}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="mt-6 flex justify-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`size-2.5 rounded-full transition-colors ${
                  i === active ? "bg-teal" : "bg-gray-200"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
