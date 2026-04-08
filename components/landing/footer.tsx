
const footerLinks = {
  Company: [
    { label: "About Us", href: "#about" },
    { label: "Our Team", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
  ],
  "Loan Programs": [
    { label: "Bridge Loans", href: "#" },
    { label: "Fix & Flip", href: "#" },
    { label: "Construction", href: "#" },
    { label: "DSCR Rental", href: "#" },
  ],
  Contact: [
    { label: "info@swiftcapitallending.com", href: "mailto:info@swiftcapitallending.com" },
    { label: "(262) 264-8606", href: "tel:+12622648606" },
    { label: "Milwaukee, WI", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="overflow-hidden bg-[#0a0a0a]">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-16 md:grid-cols-4">
          {/* Branding */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-teal font-bold text-white text-sm">
                SC
              </div>
              <span className="text-lg font-bold text-white">
                Swift Capital Lending
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/40">
              Fast, flexible hard money lending for real estate investors
              nationwide. Close in days, not months.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white/70">{title}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/35 transition-colors hover:text-teal-light"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Marquee brand text */}
      <div className="relative select-none overflow-hidden py-2">
        <div className="flex w-max animate-[marquee_60s_linear_infinite]">
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="text-[clamp(5rem,18vw,14rem)] font-black uppercase leading-none tracking-tight text-white/[0.03]"
            >
              SWIFTCAPITAL
            </span>
          ))}
        </div>
      </div>

      {/* Copyright bar */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <p className="text-xs text-white/25">
          &copy; {new Date().getFullYear()} Swift Capital Lending. All rights
          reserved.
        </p>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-white/25 transition-colors hover:text-white/50">
            Privacy Policy
          </a>
          <a href="#" className="text-xs text-white/25 transition-colors hover:text-white/50">
            Terms of Service
          </a>
          <a
            href="https://www.marchantresearch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/25 transition-colors hover:text-white/50"
          >
            Developed by Marchant Research
          </a>
        </div>
      </div>
    </footer>
  );
}
