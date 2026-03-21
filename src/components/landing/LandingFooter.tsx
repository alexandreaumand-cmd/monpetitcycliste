import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import logoBordureLight from "@/assets/logo-bordure-light.png";

const LandingFooter = () => {
  const { t } = useTranslation("home");

  return (
    <footer className="bg-secondary border-t border-bordure-gold/20 py-10 md:py-12">
      <div className="container mx-auto px-6">
        {/* Mobile: logo centré + colonnes côte à côte */}
        <div className="flex flex-col items-center md:items-start md:flex-row md:justify-between gap-8 mb-8">
          <Link to="/" className="flex items-center">
            <img src={logoBordureLight} alt="La Bordure Fantasy Cycling" className="h-20 md:h-28 w-auto" loading="lazy" />
          </Link>

          <div className="flex gap-12 md:gap-16">
            <div>
              <h4 className="text-white font-montserrat font-semibold mb-3 uppercase text-xs tracking-wider">
                {t("footer.game.title")}
              </h4>
              <ul className="space-y-1.5">
                <li><Link to="/about" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.about")}</Link></li>
                <li><Link to="/rules" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.rules")}</Link></li>
                <li><Link to="/how-to-play" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.howToPlay")}</Link></li>
                <li><Link to="/team" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.team")}</Link></li>
                <li><Link to="/contact" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.contact")}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-montserrat font-semibold mb-3 uppercase text-xs tracking-wider">
                {t("footer.legal.title")}
              </h4>
              <ul className="space-y-1.5">
                <li><Link to="/legal" className="text-white/50 hover:text-bordure-pink text-sm transition-colors font-inter">{t("footer.legal.legalNotice")}</Link></li>
                <li><Link to="/terms" className="text-white/50 hover:text-bordure-pink text-sm transition-colors font-inter">{t("footer.legal.terms")}</Link></li>
                <li><Link to="/privacy" className="text-white/50 hover:text-bordure-pink text-sm transition-colors font-inter">{t("footer.legal.privacy")}</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mb-6" />

        <p className="text-center text-white/40 text-xs font-inter">
          {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
};

export default LandingFooter;
