import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import mpcLogoVertical from "@/assets/mpc-logo-vertical.png";
import BordureStripes from "./BordureStripes";

const LandingFooter = () => {
  const { t } = useTranslation("home");

  return (
    <footer className="bg-secondary border-t border-bordure-gold/20 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <BordureStripes className="h-8" />
              <img src={mpcLogoVertical} alt="La Bordure Fantasy Cycling" className="h-14 w-auto" loading="lazy" />
              <span className="text-white font-montserrat font-bold">
                La Bordure
              </span>
            </Link>
            <p className="text-white/40 text-sm font-inter">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="text-white font-montserrat font-semibold mb-4 uppercase text-sm tracking-wider">
              {t("footer.game.title")}
            </h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.about")}</a></li>
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.rules")}</a></li>
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.game.howToPlay")}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-montserrat font-semibold mb-4 uppercase text-sm tracking-wider">
              {t("footer.legal.title")}
            </h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.legal.legalNotice")}</a></li>
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.legal.terms")}</a></li>
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.legal.privacy")}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-montserrat font-semibold mb-4 uppercase text-sm tracking-wider">
              {t("footer.community.title")}
            </h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.community.contact")}</a></li>
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.community.discord")}</a></li>
              <li><a href="#" className="text-white/50 hover:text-bordure-gold text-sm transition-colors font-inter">{t("footer.community.instagram")}</a></li>
            </ul>
          </div>
        </div>

        <BordureStripes orientation="horizontal" className="mb-8" />

        <div className="text-center">
          <p className="text-white/40 text-sm font-inter">
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
