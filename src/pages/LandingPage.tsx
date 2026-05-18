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
import RulesHighlightsSection from "@/components/landing/RulesHighlightsSection";
import { PageSeo } from "@/components/seo/PageSeo";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-secondary">
      <PageSeo
        title="La Bordure – Le Fantasy Cycling Entre Amis"
        description="Fantasy cycling entre amis. Système d'enchères, vraies courses UCI, suis les courses différemment. Crée ta ligue et domine tes potes !"
        path="/"
      />
      <LandingHeader />
      <main>
        <HeroSection />
        <GameOverviewSection />
        <HowItWorksSection />
        <LeagueTypesSection />
        <BaremePreviewSection />
        <AuctionShowcase />
        <SocialProofSection />
        <RulesHighlightsSection />
        <InstallBanner />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
