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

  /* ── Swipe-to-close ── */
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 100 || info.velocity.y > 500) {
        setMobileOpen(false);
      }
    },
    []
  );

  /* ── Animation variants ── */
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, when: "beforeChildren" as const, staggerChildren: 0.06 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3, when: "afterChildren" as const },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
    },
    exit: { opacity: 0, x: -10, filter: "blur(2px)", transition: { duration: 0.2 } },
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${
          mobileOpen ? "!bg-transparent !border-transparent !shadow-none" : ""
        } ${
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
          <a href="#" className="flex items-center gap-2 shrink-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-teal">
              <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 1L1.5 11.5H9L7.5 19L16.5 8.5H9L10.5 1Z" fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </div>
            <span className={`text-lg font-bold transition-colors duration-500 ${scrolled ? "text-gray-900" : "text-white"}`}>
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

      {/* Mobile menu — sibling to nav, not nested, so it has its own stacking context */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 200 }}
            dragElastic={{ top: 0.1, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            onKeyDown={handleKeyDown}
            className="fixed top-0 left-0 w-full h-dvh z-50 flex flex-col bg-gradient-to-br from-teal via-teal to-[#0a1540] noise-overlay lg:hidden outline-none overflow-hidden"
          >
            {/* Gradient orbs for depth */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 size-80 rounded-full bg-teal-light/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-lime/10 blur-3xl" />
            </div>

            {/* Drag indicator pill */}
            <div className="relative mx-auto mt-4 h-1 w-10 rounded-full bg-white/30 animate-swipe-hint" />

            {/* Content — pt-20 clears the nav bar */}
            <div className="relative flex flex-1 flex-col justify-center px-8 pt-20 pb-12">
              {/* Nav links */}
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <motion.a
                    key={link.label}
                    variants={itemVariants}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className="group flex items-center justify-between py-4 text-3xl font-bold text-white transition-colors hover:text-lime"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="size-6 text-white/30 transition-all group-hover:text-lime group-hover:translate-x-1" />
                  </motion.a>
                ))}
              </div>

              {/* Gradient divider */}
              <motion.div
                variants={itemVariants}
                className="my-8 h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10"
              />

              {/* Phone card */}
              <motion.a
                variants={itemVariants}
                href="tel:+12622648606"
                className="flex items-center gap-4 rounded-2xl bg-white/[0.06] px-5 py-4 backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-lime/20">
                  <Phone className="size-5 text-lime" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white/60">Call Us Now</span>
                  <span className="text-lg font-semibold text-white">(262) 264-8606</span>
                </div>
              </motion.a>

              {/* CTA button */}
              <motion.a
                variants={itemVariants}
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick("#contact");
                }}
                className="relative mt-6 flex h-16 items-center justify-center overflow-hidden rounded-2xl bg-lime text-lg font-bold text-gray-900 transition-colors hover:bg-lime/90"
              >
                <div className="shimmer-bar" />
                <span className="relative">Get Funded Today</span>
                <ArrowRight className="relative ml-2 size-5" />
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
