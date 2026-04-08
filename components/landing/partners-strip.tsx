import Image from "next/image";
import Link from "next/link";

export function About() {
  return (
    <section id="about" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left — Team Photo */}
          <div className="relative min-h-[400px] overflow-hidden rounded-2xl lg:min-h-[560px]">
            <Image
              src="/team.jpg"
              alt="Swift Capital Lending founders"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {/* Frosted glass label */}
            <div className="absolute bottom-4 left-4 z-10 rounded-full border border-white/20 bg-white/70 px-4 py-2 backdrop-blur-md">
              <p className="text-sm font-semibold text-gray-900">
                Swift Capital Lending
              </p>
              <p className="text-xs text-gray-500">Founders</p>
            </div>
          </div>

          {/* Right — Text + Property Image */}
          <div className="flex flex-col justify-center">
            <span className="text-sm font-medium uppercase tracking-widest text-teal/70">
              Meet the Swift Capital Team
            </span>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Milwaukee&apos;s Real Estate Financing Experts
            </h2>

            <p className="mt-5 leading-relaxed text-gray-500">
              Swift Capital Lending delivers timely, flexible financing solutions
              for real estate investors across the Milwaukee metro area. Our
              experienced team combines deep local market knowledge with
              streamlined underwriting, so you get customized loan structures
              that close fast — whether you&apos;re flipping, building, or
              scaling your portfolio.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="#contact"
                className="inline-flex h-14 items-center justify-center rounded-full bg-teal px-10 text-base font-semibold text-white transition-shadow duration-300 hover:shadow-[0_0_24px_oklch(0.45_0.24_264/30%)]"
              >
                Learn More
              </Link>
              <Link
                href="/apply"
                className="inline-flex h-14 items-center justify-center rounded-full border border-gray-200 px-10 text-base font-semibold text-gray-900 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                Apply Now
              </Link>
            </div>

            {/* Before / After property image */}
            <div className="relative mt-10 overflow-hidden rounded-xl">
              <Image
                src="/before-after.jpg"
                alt="Property before and after renovation"
                width={800}
                height={400}
                className="w-full object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              {/* Labels */}
              <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 backdrop-blur-sm">
                Before
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 backdrop-blur-sm">
                After
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
