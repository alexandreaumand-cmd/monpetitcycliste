import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import mpcLogo from "@/assets/mpc-logo.png";

const LandingHeader = () => {
  const { t } = useTranslation("home");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-yellow-500/20">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={mpcLogo} alt="Mon Petit Cycliste" className="h-10 w-10" />
          <span className="text-white font-poppins font-bold text-lg hidden sm:block">
            Mon Petit Cycliste
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link to="/auth">
            <Button variant="default" size="sm">
              {t("header.login")}
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default LandingHeader;
