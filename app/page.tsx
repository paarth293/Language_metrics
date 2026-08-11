import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/home/Hero";
import StatsBar from "@/components/home/StatsBar";
import LanguageMarquee from "@/components/home/LanguageMarquee";
import HowItWorks from "@/components/home/HowItWorks";
import Features from "@/components/home/Features";
import TeacherSpotlight from "@/components/home/TeacherSpotlight";
import Pricing from "@/components/home/Pricing";
import CTASection from "@/components/home/CTASection";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <StatsBar />
      <LanguageMarquee />
      <HowItWorks />
      <Features />
      <TeacherSpotlight />
      <Pricing />
      <CTASection />
      <Footer />
    </main>
  );
}
