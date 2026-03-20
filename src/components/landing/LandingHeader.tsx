import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import mpcLogo from "@/assets/logo-carre-rose.png";

const LandingHeader = () => {
  const { t } = useTranslation("home");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-secondary/90 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={mpcLogo} alt="La Bordure" className="h-9 w-9" />
          <span className="text-white font-montserrat font-bold text-lg">
            La Bordure
          </span>
        </Link>

        <Link to="/auth">
          <Button variant="default" size="sm">
            {t("header.login")}
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default LandingHeader;
