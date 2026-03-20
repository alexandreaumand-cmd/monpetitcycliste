import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import mpcLogo from "@/assets/logo-carre-rose.png";

const LandingHeader = () => {
  const { t } = useTranslation("home");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="container mx-auto px-5 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={mpcLogo} alt="La Bordure" className="h-9 w-9" />
          <span className="text-white font-montserrat font-bold text-lg">
            La Bordure
          </span>
        </Link>

        <Link to="/auth">
          <Button
            size="sm"
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 font-inter text-sm px-5"
          >
            {t("header.login")}
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default LandingHeader;