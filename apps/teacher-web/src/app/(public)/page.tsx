import Hero from "@/features/home/components/Hero";
import StatsBar from "@/features/home/components/StatsBar";
import LanguageMarquee from "@/features/home/components/LanguageMarquee";
import HowItWorks from "@/features/home/components/HowItWorks";
import Features from "@/features/home/components/Features";
import TeacherSpotlight from "@/features/home/components/TeacherSpotlight";
import Pricing from "@/features/home/components/Pricing";
import Mission from "@/features/home/components/Mission";
import CTASection from "@/features/home/components/CTASection";

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
