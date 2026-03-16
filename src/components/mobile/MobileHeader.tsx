import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import mpcLogo from "@/assets/mpc-logo.png";
import { LeagueSwitcherHeaderMobile } from "@/components/leagues/LeagueSwitcherHeaderMobile";
import { useTranslation } from "react-i18next";

interface NavItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface MobileHeaderProps {
  title: string;
  navItems: NavItem[];
}

export const MobileHeader = ({ title, navItems }: MobileHeaderProps) => {
  const { t } = useTranslation('navigation');
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-bordure-gold/30 bg-secondary/95 backdrop-blur safe-top">
      <div className="flex h-14 items-center justify-between px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-bordure-gold hover:text-white touch-target">
              <Menu className="h-6 w-6" />
              <span className="sr-only">{t('menu.openMenu')}</span>
            </Button>
          </SheetTrigger>
          
          <SheetContent side="left" className="w-[280px] safe-bottom">
            <nav className="flex flex-col gap-2 mt-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start touch-target",
                      isActive && "shadow-sm"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    {item.icon && <span className="mr-2">{item.icon}</span>}
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link to="/dashboard/home" className="shrink-0">
            <img 
              src={mpcLogo} 
              alt="Logo La Bordure" 
              className="h-8 w-auto"
            />
          </Link>
          <LeagueSwitcherHeaderMobile />
        </div>

        <div className="w-10" />
      </div>
    </header>
  );
};
