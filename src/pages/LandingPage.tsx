import {
  LandingHeader,
  HeroSection,
  GameOverviewSection,
  HowItWorksSection,
  AuctionShowcase,
  SocialProofSection,
  CTASection,
  LandingFooter,
} from "@/components/landing";
import InstallBanner from "@/components/landing/InstallBanner";
import LeagueTypesSection from "@/components/landing/LeagueTypesSection";
import BaremePreviewSection from "@/components/landing/BaremePreviewSection";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-secondary">
      <LandingHeader />
      <main>
        <HeroSection />
        <GameOverviewSection />
        <HowItWorksSection />
        <LeagueTypesSection />
        <BaremePreviewSection />
        <AuctionShowcase />
        <SocialProofSection />
        <InstallBanner />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
