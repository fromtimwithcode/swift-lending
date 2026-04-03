const partners = [
  "Blackstone",
  "KKR Capital",
  "CBRE Group",
  "Marcus & Millichap",
  "Cushman Wakefield",
  "JLL Partners",
  "Newmark Group",
  "Walker & Dunlop",
];

export function PartnersStrip() {
  return (
    <section className="border-y border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-6 flex items-center justify-center gap-4">
          <div className="h-px w-12 bg-gray-200" />
          <p className="text-xs font-medium uppercase tracking-widest text-gray-300">
            Trusted by Leading Firms
          </p>
          <div className="h-px w-12 bg-gray-200" />
        </div>
      </div>
      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />

        <div className="animate-marquee flex w-max items-center gap-20">
          {[...partners, ...partners].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-lg font-semibold text-gray-300 transition-colors hover:text-teal/60"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
