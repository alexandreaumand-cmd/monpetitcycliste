import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";

interface StaticPageLayoutProps {
  children: React.ReactNode;
}

const StaticPageLayout = ({ children }: StaticPageLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-bordure-cream">
      <LandingHeader />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-5 max-w-3xl">
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default StaticPageLayout;
