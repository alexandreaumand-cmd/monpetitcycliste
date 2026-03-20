import {
  LandingHeader,
  HeroSection,
  HowItWorksSection,
  AuctionShowcase,
  SocialProofSection,
  CTASection,
  LandingFooter,
} from "@/components/landing";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-secondary">
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <AuctionShowcase />
        <SocialProofSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
