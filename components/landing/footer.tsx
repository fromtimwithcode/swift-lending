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
    { label: "(800) 555-SWIFT", href: "tel:+18005557943" },
    { label: "New York, NY", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-white" id="contact">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-16 md:grid-cols-4">
          {/* Branding */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-teal font-bold text-white text-sm">
                SC
              </div>
              <span className="text-lg font-bold text-gray-900">
                Swift <span className="text-teal">Capital</span> Lending
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Fast, flexible hard money lending for real estate investors
              nationwide. Close in days, not months.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-teal"
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

      {/* Copyright bar */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <p className="text-xs text-gray-300">
          &copy; {new Date().getFullYear()} Swift Capital Lending. All rights
          reserved.
        </p>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-gray-300 hover:text-gray-500">
            Privacy Policy
          </a>
          <a href="#" className="text-xs text-gray-300 hover:text-gray-500">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
