import { Calendar, Bike, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import mpcLogo from "@/assets/mpc-logo.png";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UnifiedProfileDropdown } from "@/components/layout/UnifiedProfileDropdown";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { ManagerDropdown } from "@/components/layout/ManagerDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  // Mobile: optimized compact layout
  if (isMobile) {
    return (
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo only - no title on mobile */}
          <img
            src={mpcLogo}
            alt="Logo Mon Petit Cycliste"
            className="h-8 w-8"
          />

          {/* Mobile actions - consolidated */}
          <div className="flex items-center gap-1">
            {/* More menu with Calendar + Data */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-md">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => navigate('/dashboard/calendar')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {t('header.calendar')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/dashboard/data')}>
                  <Bike className="mr-2 h-4 w-4" />
                  {t('header.data')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
            className="px-3 py-1.5 text-yellow-500 hover:text-yellow-400 hover:underline underline-offset-4 transition-colors font-medium flex items-center gap-1.5"
          >
            <Bike className="h-4 w-4" />
            {t('header.data')}
          </button>
        </nav>

        {/* Right: Notifications + Profile Dropdown */}
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
