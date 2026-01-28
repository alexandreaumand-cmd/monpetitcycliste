import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import mpcLogo from "@/assets/mpc-logo.png";

const LandingFooter = () => {
  const { t } = useTranslation("home");

  return (
    <footer className="bg-gray-950 border-t border-gray-800 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src={mpcLogo} alt="Mon Petit Cycliste" className="h-10 w-10" />
              <span className="text-white font-poppins font-bold">
                Mon Petit Cycliste
              </span>
            </Link>
            <p className="text-gray-500 text-sm">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Game Links */}
          <div>
            <h4 className="text-white font-poppins font-semibold mb-4">
              {t("footer.game.title")}
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.game.about")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.game.rules")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.game.howToPlay")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-white font-poppins font-semibold mb-4">
              {t("footer.legal.title")}
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.legal.legalNotice")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.legal.terms")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.legal.privacy")}
                </a>
              </li>
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h4 className="text-white font-poppins font-semibold mb-4">
              {t("footer.community.title")}
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.community.contact")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.community.discord")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#FFD500] text-sm transition-colors">
                  {t("footer.community.instagram")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
