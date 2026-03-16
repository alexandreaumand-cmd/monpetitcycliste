import {
  LandingHeader,
  HeroSection,
  HowItWorksSection,
  LeagueTypesSection,
  ScoringSection,
  TeamPreviewSection,
  WhyPlaySection,
  TestimonialsSection,
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
        <LeagueTypesSection />
        <ScoringSection />
        <TeamPreviewSection />
        <WhyPlaySection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
