import Hero from "@/components/shared/home/Hero";
import StatsBar from "@/components/shared/home/StatsBar";
import LanguageMarquee from "@/components/shared/home/LanguageMarquee";
import HowItWorks from "@/components/shared/home/HowItWorks";
import Features from "@/components/shared/home/Features";
import TeacherSpotlight from "@/components/shared/home/TeacherSpotlight";
import Pricing from "@/components/shared/home/Pricing";
import Mission from "@/components/shared/home/Mission";
import CTASection from "@/components/shared/home/CTASection";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <StatsBar />
      <LanguageMarquee />
      <HowItWorks />
      <Features />
      <TeacherSpotlight />
      <Pricing />
      <Mission />
      <CTASection />
    </main>
  );
}
