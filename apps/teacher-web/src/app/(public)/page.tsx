import Hero from "@/features/home/components/Hero";
import StatsBar from "@/features/home/components/StatsBar";
import LanguageMarquee from "@/features/home/components/LanguageMarquee";
import HowItWorks from "@/features/home/components/HowItWorks";
import LiveClassExperience from "@/features/home/components/LiveClassExperience";
import TeacherTrust from "@/features/home/components/TeacherTrust";
import Features from "@/features/home/components/Features";
import TeacherSpotlight from "@/features/home/components/TeacherSpotlight";
import Pricing from "@/features/home/components/Pricing";
import CoinSystem from "@/features/home/components/CoinSystem";
import CTASection from "@/features/home/components/CTASection";
import VisionSection from "@/features/home/components/VisionSection";
import FAQSection from "@/features/home/components/FAQSection";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <StatsBar />
      <LanguageMarquee />
      <HowItWorks />
      <LiveClassExperience />
      <TeacherTrust />
      <Features />
      <TeacherSpotlight />
      <Pricing />
      <CoinSystem />
      <CTASection />
      <VisionSection />
      <FAQSection />
    </main>
  );
}
