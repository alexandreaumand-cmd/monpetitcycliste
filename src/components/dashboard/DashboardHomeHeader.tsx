import { Settings, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagerDropdown } from "@/components/layout/ManagerDropdown";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import mpcLogo from "@/assets/mpc-logo.png";
import { useNavigate, useSearchParams } from "react-router-dom";

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
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');

  const buildNavUrl = (path: string) => {
    return currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
  };

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        {/* Logo + Titre */}
        <div className="flex items-center gap-2 md:gap-3">
          <img
            src={mpcLogo}
            alt="Logo Mon Petit Cycliste"
            className={cn(
              "h-8 w-8",
              !isMobile && "md:h-12 md:w-12"
            )}
          />
          <h1 className={cn(
            "font-montserrat font-bold text-white",
            isMobile ? "text-sm" : "text-xl"
          )}>
            Mon Petit Cycliste
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Data Button */}
          <Button
            variant="outline"
            size={isMobile ? "icon" : "sm"}
            onClick={() => navigate(buildNavUrl('/dashboard/data'))}
            className={cn(
              "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10",
              !isMobile && "gap-2"
            )}
          >
            <Database className="h-4 w-4" />
            {!isMobile && "Data"}
          </Button>

          {manager && (
            <ManagerDropdown
              manager={manager}
              isAdmin={isAnyAdmin}
              onSignOut={onSignOut}
              compact={isMobile}
            />
          )}

          <NotificationCenter />

          {isSuperAdmin && (
            <Button
              variant="secondary"
              size={isMobile ? "icon" : "sm"}
              onClick={onNavigateAdmin}
              className={!isMobile ? "gap-2" : ""}
            >
              <Settings className="h-4 w-4" />
              {!isMobile && "Super Admin"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
