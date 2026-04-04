"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 500, damping: 15 };

const navLinks = [
  { label: "Home", href: "#" },
  { label: "Loan Programs", href: "#programs" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setPastHero(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal">
            <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5 1L1.5 11.5H9L7.5 19L16.5 8.5H9L10.5 1Z" fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </div>
          <span className={`text-lg font-bold transition-colors duration-500 ${scrolled ? "text-gray-900" : "text-white"}`}>
            Swift Capital Lending
          </span>
        </a>

        {/* Desktop links — pill container */}
        <div className={`hidden md:flex items-center rounded-full px-1.5 py-1.5 transition-colors duration-500 ${scrolled ? "bg-gray-900/5" : "bg-white/10"}`}>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
                scrolled
                  ? "text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <motion.button
            whileHover="hover"
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative flex h-12 items-center gap-2 overflow-hidden rounded-full bg-teal px-8 text-base font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
          >
            {pastHero && <div className="shimmer-bar" />}
            <span className="relative">Get Funded</span>
            <motion.span
              variants={{ hover: { x: 4 } }}
              transition={spring}
              className="relative flex"
            >
              <ArrowRight className="size-4" />
            </motion.span>
          </motion.button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative z-50 flex size-10 flex-col items-center justify-center gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 transition-all duration-300 ${
              scrolled ? "bg-gray-900" : "bg-white"
            } ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 transition-all duration-300 ${
              scrolled ? "bg-gray-900" : "bg-white"
            } ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 transition-all duration-300 ${
              scrolled ? "bg-gray-900" : "bg-white"
            } ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-black/5 bg-white/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-lg text-gray-600 transition-colors hover:text-teal"
                >
                  {link.label}
                </a>
              ))}
              <Button className="mt-2 bg-teal text-white font-semibold hover:bg-teal/90 w-full">
                Get Funded
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
