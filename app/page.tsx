import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { PartnersStrip } from "@/components/landing/partners-strip";
import { LoanCard } from "@/components/landing/loan-card";
import { Features } from "@/components/landing/features";
import { SimpleFast } from "@/components/landing/simple-fast";
import { Innovation } from "@/components/landing/innovation";
import { Testimonials } from "@/components/landing/testimonials";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <PartnersStrip />
      <LoanCard />
      <Features />
      <SimpleFast />
      <Innovation />
      <Testimonials />
      <CTASection />
      <Footer />
    </>
  );
}
