import { useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { MobileBottomBar } from "./MobileBottomBar";
import { MobileDrawer } from "./MobileDrawer";
import { Button } from "@/components/ui/button";

import { Menu } from "lucide-react";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";
import { useLeague } from "@/contexts/LeagueContext";
import { useCurrentLeagueInfo } from "@/hooks/useCurrentLeagueInfo";
import { NotificationCenter } from "@/components/layout/NotificationCenter";

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
  const { leagueId } = useLeague();
  const { season, isLoading: seasonsLoading } = useLeagueSeason();
  const { data: leagueInfo } = useCurrentLeagueInfo();
  
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
              {leagueInfo ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  • {leagueInfo.gameModeName} {leagueInfo.seasonYear}
                </span>
              ) : (
                season?.annee && (
                  <span className="ml-2 text-xs text-muted-foreground">• {season.annee}</span>
                )
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

      {/* Side drawer - Season is now derived from league */}
      {!isHomePage && (
        <MobileDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          manager={manager}
          isAdmin={isAdmin}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
};
