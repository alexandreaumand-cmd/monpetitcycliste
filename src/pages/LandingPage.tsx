import {
  LandingHeader,
  HeroSection,
  HowItWorksSection,
  LeagueTypesSection,
  ScoringSection,
  WhyPlaySection,
  TestimonialsSection,
  CTASection,
  LandingFooter,
} from "@/components/landing";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-black">
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <LeagueTypesSection />
        <ScoringSection />
        <WhyPlaySection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
