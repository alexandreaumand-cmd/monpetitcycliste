import { useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { MobileBottomBar } from "./MobileBottomBar";
import { MobileDrawer } from "./MobileDrawer";
import { Button } from "@/components/ui/button";

import { Menu } from "lucide-react";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { useLeague } from "@/contexts/LeagueContext";
import { Badge } from "@/components/ui/badge";
import { LeagueSwitcherMobile } from "@/components/leagues/LeagueSwitcherMobile";

interface MobileLayoutProps {
  children: ReactNode;
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
  title?: string;
}

export const MobileLayout = ({
  children,
  manager,
  isAdmin,
  onSignOut,
  title = "Mon Petit Cycliste",
}: MobileLayoutProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { selectedSeason, setSelectedSeason, seasons, isLoading: seasonsLoading } = useSeasonContext();
  const { leagueId } = useLeague();
  
  const isHomePage = location.pathname === '/dashboard/home' || location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with menu button - masqué sur home */}
      {!isHomePage && (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
          <div className="flex h-14 items-center justify-between px-4">
            <Button
              variant="ghost"
              size="icon"
              className="touch-target"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Ouvrir le menu</span>
            </Button>

            <h1 className="text-lg font-bold truncate flex-1 text-center">
              {title}
              {selectedSeason?.annee && (
                <span className="ml-2 text-xs text-muted-foreground">• {selectedSeason.annee}</span>
              )}
            </h1>

            <NotificationCenter />
          </div>
        </header>
      )}

      {/* Main content */}
      <main className="pb-safe">{children}</main>

      {/* Bottom navigation bar - masquée sur home */}
      {!isHomePage && <MobileBottomBar isAdmin={isAdmin} />}

      {/* Side drawer with League Selector */}
      {!isHomePage && (
        <MobileDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          manager={manager}
          isAdmin={isAdmin}
          onSignOut={onSignOut}
          leagueSelector={<LeagueSwitcherMobile />}
        />
      )}
    </div>
  );
};
