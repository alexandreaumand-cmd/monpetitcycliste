import { Calendar, Bike } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import faviconLogo from "@/assets/logo-carre-rose.png";
import logoBordureLight from "@/assets/logo-bordure-light.png";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UnifiedProfileDropdown } from "@/components/layout/UnifiedProfileDropdown";
import { NotificationCenter } from "@/components/layout/NotificationCenter";

interface DashboardHomeHeaderProps {
  manager: any;
  isAnyAdmin: boolean;
  isSuperAdmin: boolean;
  onSignOut: () => void;
  onNavigateAdmin: () => void;
}

export function DashboardHomeHeader({
  manager,
  isAnyAdmin,
  isSuperAdmin,
  onSignOut,
  onNavigateAdmin,
}: DashboardHomeHeaderProps) {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');

  if (isMobile) {
    return (
      <header className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-bordure-gold/30 safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img
            src={faviconLogo}
            alt="Logo La Bordure"
            loading="eager"
            fetchPriority="high"
            width={32}
            height={32}
            className="h-8 w-8"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/dashboard/calendar')}
              className="p-2 text-bordure-gold hover:bg-bordure-gold/10 rounded-md"
              aria-label={t('header.calendar')}
            >
              <Calendar className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/dashboard/data')}
              className="p-2 text-bordure-gold hover:bg-bordure-gold/10 rounded-md"
              aria-label={t('header.data')}
            >
              <Bike className="h-5 w-5" />
            </button>
            
            {manager && (
              <UnifiedProfileDropdown
                manager={manager}
                isAdmin={isAnyAdmin}
                isSuperAdmin={isSuperAdmin}
                onSignOut={onSignOut}
                onNavigateAdmin={onNavigateAdmin}
              />
            )}
            <NotificationCenter variant="dark" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-bordure-gold/30 safe-top">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logoBordureLight}
            alt="La Bordure"
            loading="eager"
            fetchPriority="high"
            className="h-10 w-auto"
          />
        </div>

        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigate('/dashboard/calendar')}
            className="px-3 py-1.5 text-bordure-gold hover:text-white hover:underline underline-offset-4 transition-colors font-medium font-inter"
          >
            {t('header.calendar')}
          </button>
          <span className="text-bordure-gold/30">|</span>
          <button
            onClick={() => navigate('/dashboard/data')}
            className="px-3 py-1.5 text-bordure-gold hover:text-white hover:underline underline-offset-4 transition-colors font-medium flex items-center gap-1.5 font-inter"
          >
            <Bike className="h-4 w-4" />
            {t('header.data')}
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <NotificationCenter variant="dark" />
          {manager && (
            <UnifiedProfileDropdown
              manager={manager}
              isAdmin={isAnyAdmin}
              isSuperAdmin={isSuperAdmin}
              onSignOut={onSignOut}
              onNavigateAdmin={onNavigateAdmin}
            />
          )}
        </div>
      </div>
    </header>
  );
}
