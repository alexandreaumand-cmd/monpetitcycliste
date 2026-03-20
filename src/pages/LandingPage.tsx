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

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-secondary">
      <LandingHeader />
      <main>
        <HeroSection />
        <GameOverviewSection />
        <HowItWorksSection />
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
