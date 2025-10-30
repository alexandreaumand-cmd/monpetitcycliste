import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagerDropdown } from "@/components/layout/ManagerDropdown";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import mpcLogo from "@/assets/mpc-logo.png";

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
