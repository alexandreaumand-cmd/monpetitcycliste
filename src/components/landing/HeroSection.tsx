import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import heroCycling from "@/assets/hero-cycling.jpg";

const HeroSection = () => {
  const { t } = useTranslation("home");

  const scrollToNextSection = () => {
    const nextSection = document.getElementById("how-it-works");
    nextSection?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={heroCycling}
          alt="Cycling hero"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-20 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold text-white mb-2 animate-fade-in">
          {t("hero.title1")}
        </h1>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold text-[#FFD500] mb-6 animate-fade-in">
          {t("hero.title2")}
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 animate-fade-in">
          {t("hero.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
          <Link to="/auth">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
              {t("hero.cta.createLeague")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-lg px-8 py-6 border-white text-white hover:bg-white hover:text-black"
            onClick={scrollToNextSection}
          >
            {t("hero.cta.discover")}
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToNextSection}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce"
      >
        <ChevronDown size={32} />
      </button>
    </section>
  );
};

export default HeroSection;
