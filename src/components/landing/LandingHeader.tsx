import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import mpcLogo from "@/assets/logo-carre-rose.png";
import BordureStripes from "./BordureStripes";

const LandingHeader = () => {
  const { t } = useTranslation("home");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-bordure-gold/20">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <BordureStripes className="h-8 hidden sm:flex" />
          <img src={mpcLogo} alt="La Bordure Fantasy Cycling" className="h-10 w-10" />
          <span className="text-primary-foreground font-montserrat font-bold text-lg hidden sm:block" style={{ color: "hsl(0 0% 100%)" }}>
            La Bordure
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
