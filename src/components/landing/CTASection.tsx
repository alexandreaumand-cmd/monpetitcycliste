import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import cyclistClimbing from "@/assets/cyclist-climbing.jpg";

const CTASection = () => {
  const { t } = useTranslation("home");

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={cyclistClimbing}
          alt="Cyclist climbing"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
          {t("cta.title")}
        </h2>
        <p className="text-gray-300 mb-8 max-w-md mx-auto">
          {t("cta.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/auth">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 shadow-lg shadow-yellow-500/20">
              {t("cta.createLeague")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
