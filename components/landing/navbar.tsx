"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Apply", href: "#apply" },
  { label: "Invest", href: "#invest" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  /* ── Scroll tracking ── */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setPastHero(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  /* ── Escape key & resize guard ── */
  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  /* ── Focus management ── */
  useEffect(() => {
    if (mobileOpen) {
      requestAnimationFrame(() => menuRef.current?.focus({ preventScroll: true }));
    } else {
      hamburgerRef.current?.focus();
    }
  }, [mobileOpen]);

  /* ── Focus trap ── */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !menuRef.current) return;

    const focusable = menuRef.current.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  /* ── Close → scroll for nav links ── */
  const handleNavClick = useCallback((href: string) => {
    setMobileOpen(false);
    setTimeout(() => {
      if (href === "#") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      }
    }, 400);
  }, []);

  /* ── Animation variants (for menu content only) ── */
  const itemVariants = {
    hidden: { opacity: 0, x: -20, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
    },
  };

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  return (
    <>
      {/* ── Nav bar ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[9999] transition-[background-color,border-color,box-shadow] duration-500 ${
          mobileOpen
            ? "bg-transparent"
            : scrolled
              ? "bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm"
              : "bg-transparent"
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 ${
            scrolled ? "py-5 lg:py-3" : "py-5"
          }`}
        >
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 shrink-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-teal">
              <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 1L1.5 11.5H9L7.5 19L16.5 8.5H9L10.5 1Z" fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </div>
            <span className={`text-lg font-bold transition-colors duration-500 ${
              mobileOpen ? "text-white" : scrolled ? "text-gray-900" : "text-white"
            }`}>
              Swift Capital Lending
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  scrolled
                    ? "text-gray-600 hover:text-gray-900"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-5 shrink-0">
            <a
              href="/login"
              className={`text-sm font-medium transition-colors duration-500 ${
                scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/70 hover:text-white"
              }`}
            >
              Log In
            </a>

            <a
              href="tel:+12622648606"
              className={`flex items-center gap-2.5 transition-colors duration-500 ${
                scrolled ? "text-gray-700" : "text-white"
              }`}
            >
              <span className={`flex size-9 items-center justify-center rounded-full border transition-colors duration-500 ${
                scrolled ? "border-gray-200 bg-gray-50" : "border-white/20 bg-white/10"
              }`}>
                <Phone className="size-4" />
              </span>
              <span className="text-sm font-medium">(262) 264-8606</span>
            </a>

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
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="relative flex"
              >
                <ArrowRight className="size-4" />
              </motion.span>
            </motion.button>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative flex size-10 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <span
              className={`block h-0.5 w-6 transition-all duration-300 ${
                mobileOpen ? "bg-white translate-y-2 rotate-45" : scrolled ? "bg-gray-900" : "bg-white"
              }`}
            />
            <span
              className={`block h-0.5 w-6 transition-all duration-300 ${
                mobileOpen ? "bg-white opacity-0" : scrolled ? "bg-gray-900" : "bg-white"
              }`}
            />
            <span
              className={`block h-0.5 w-6 transition-all duration-300 ${
                mobileOpen ? "bg-white -translate-y-2 -rotate-45" : scrolled ? "bg-gray-900" : "bg-white"
              }`}
            />
          </button>
        </div>
      </nav>

      {/* ── Mobile menu — plain div, no framer-motion drag/transforms ── */}
      <div
        id="mobile-menu"
        ref={menuRef}
        role="dialog"
        aria-modal={mobileOpen}
        aria-label="Navigation menu"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`fixed inset-0 z-[9998] flex flex-col bg-gradient-to-br from-teal via-teal to-[#0a1540] lg:hidden outline-none overflow-hidden transition-[opacity,visibility] duration-300 ${
          mobileOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        {/* Gradient orbs for depth */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 size-80 rounded-full bg-teal-light/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-lime/10 blur-3xl" />
        </div>

        {/* Scrollable content area */}
        <div className="relative flex flex-1 flex-col px-8 pt-24 overflow-y-auto">
          {/* Nav links — animated with framer-motion */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-1"
              >
                {navLinks.map((link) => (
                  <motion.a
                    key={link.label}
                    variants={itemVariants}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className="group flex items-center justify-between py-3.5 text-2xl font-bold text-white transition-colors hover:text-lime"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="size-6 text-white/30 transition-all group-hover:text-lime group-hover:translate-x-1" />
                  </motion.a>
                ))}

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pinned bottom actions */}
        <div className="relative shrink-0 px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex flex-col gap-3">
            <a
              href="/login"
              className="flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
            >
              Log In
            </a>
            <a
              href="tel:+12622648606"
              className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-white/[0.06] text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
            >
              <Phone className="size-4 text-lime" />
              <span>(262) 264-8606</span>
            </a>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#contact");
              }}
              className="relative flex h-16 items-center justify-center overflow-hidden rounded-2xl bg-lime text-lg font-bold text-gray-900 transition-colors hover:bg-lime/90"
            >
              <div className="shimmer-bar" />
              <span className="relative">Get Funded Today</span>
              <ArrowRight className="relative ml-2 size-5" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
