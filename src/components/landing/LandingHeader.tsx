import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import logoDark from "@/assets/logo-bordure.png";

const LandingHeader = () => {
  const { t } = useTranslation("home");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#F6F3ED] shadow-sm">
      <div className="container mx-auto px-5 py-1 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logoDark} alt="La Bordure" className="h-16 w-auto" />
        </Link>

        <span className="hidden md:block text-xs text-[#1B5E3B] font-inter italic">
          {t("header.tagline")}
        </span>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="ghost" size="icon" className="text-[#1B5E3B] hover:bg-bordure-gold/10" />
          <Link to="/auth">
            <Button
              size="sm"
              className="bg-bordure-gold hover:bg-bordure-gold/90 text-[#1B5E3B] font-montserrat font-bold text-sm px-5 hidden sm:inline-flex"
            >
              {t("header.login")}
            </Button>
            <Button
              size="icon"
              className="bg-bordure-gold hover:bg-bordure-gold/90 text-[#1B5E3B] sm:hidden h-9 w-9"
            >
              <LogIn className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;