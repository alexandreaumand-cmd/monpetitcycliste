import { Calendar, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import mpcLogo from "@/assets/mpc-logo.png";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UnifiedProfileDropdown } from "@/components/layout/UnifiedProfileDropdown";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { ManagerDropdown } from "@/components/layout/ManagerDropdown";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

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

  const buildNavUrl = (path: string) => {
    return currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
  };

  // Mobile: keep original compact layout
  if (isMobile) {
    return (
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img
              src={mpcLogo}
              alt="Logo Mon Petit Cycliste"
              className="h-8 w-8"
            />
            <h1 className="font-montserrat font-bold text-white text-sm">
              Mon Petit Cycliste
            </h1>
          </div>

          {/* Mobile actions - keep compact */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/dashboard/calendar')}
              className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-md"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard/data')}
              className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-md"
            >
              <Database className="h-4 w-4" />
            </button>
            <LanguageSwitcher
              variant="ghost"
              size="icon"
              className="text-yellow-500 hover:bg-yellow-500/10 h-8 w-8"
            />
            {manager && (
              <ManagerDropdown
                manager={manager}
                isAdmin={isAnyAdmin}
                onSignOut={onSignOut}
                compact={true}
              />
            )}
            <NotificationCenter />
          </div>
        </div>
      </header>
    );
  }

  // Desktop: new clean layout with 3 zones
  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <img
            src={mpcLogo}
            alt="Logo Mon Petit Cycliste"
            className="h-10 w-10"
          />
          <h1 className="font-montserrat font-bold text-white text-lg">
            Mon Petit Cycliste
          </h1>
        </div>

        {/* Center: Navigation links */}
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigate('/dashboard/calendar')}
            className="px-3 py-1.5 text-yellow-500 hover:text-yellow-400 hover:underline underline-offset-4 transition-colors font-medium"
          >
            {t('header.calendar')}
          </button>
          <span className="text-yellow-500/30">|</span>
          <button
            onClick={() => navigate('/dashboard/data')}
            className="px-3 py-1.5 text-yellow-500 hover:text-yellow-400 hover:underline underline-offset-4 transition-colors font-medium"
          >
            {t('header.data')}
          </button>
        </nav>

        {/* Right: Unified Profile Dropdown */}
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
    </header>
  );
}
