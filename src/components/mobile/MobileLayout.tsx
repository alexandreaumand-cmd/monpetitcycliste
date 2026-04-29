import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";

import { MobileBottomBar } from "./MobileBottomBar";
import faviconCap from "@/assets/favicon-cap.jpeg";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { useLeague } from "@/contexts/LeagueContext";
import { LeagueSwitcherHeaderMobile } from "@/components/leagues/LeagueSwitcherHeaderMobile";

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
  title = "La Bordure",
}: MobileLayoutProps) => {
  const location = useLocation();
  const { leagueId } = useLeague();

  const isHomePage =
    location.pathname === "/dashboard/home" || location.pathname === "/dashboard";

  return (
    <div className="min-h-screen bg-background pb-20 max-w-[100vw] [overflow-x:clip]">
      {/* Header — masqué sur home. Plus de bouton hamburger : la nav est entièrement dans la barre du bas. */}
      {!isHomePage && (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
          <div className="flex h-14 items-center gap-2 px-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Link to="/dashboard/home" className="shrink-0">
                <img
                  src={faviconCap}
                  alt="La Bordure"
                  loading="eager"
                  className="h-8 w-8 rounded-sm object-contain"
                />
              </Link>

              {leagueId && <LeagueSwitcherHeaderMobile />}
            </div>

            <NotificationCenter />
          </div>
        </header>
      )}

      {/* Main content */}
      <main className="pb-safe overflow-x-hidden">{children}</main>

      {/* Bottom navigation bar — masquée sur home */}
      {!isHomePage && (
        <MobileBottomBar
          isAdmin={isAdmin}
          manager={manager}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
};
