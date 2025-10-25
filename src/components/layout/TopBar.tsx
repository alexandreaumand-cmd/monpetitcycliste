import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { LeagueInfoBadge } from "@/components/leagues/LeagueInfoBadge";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManagerDropdown } from "./ManagerDropdown";

interface TopBarProps {
  onSignOut: () => void;
  manager: any;
  isAdmin: boolean;
}

export function TopBar({ onSignOut, manager, isAdmin }: TopBarProps) {
  const { leagueId } = useLeague();
  const { season, seasons } = useLeagueSeason();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        {/* League and Season selectors on the left */}
        <div className="flex items-center gap-3">
          {/* League Switcher */}
          <LeagueSwitcher />
          
          {/* Infos de la ligue active */}
          {leagueId && <LeagueInfoBadge />}
          
          {/* Season is now derived from league - no longer user-selectable */}
        </div>
        
        <div className="flex-1" />
        
        {/* Manager, Notifications and Logout on the right */}
        <div className="flex items-center gap-3">
          {manager && (
            <ManagerDropdown 
              manager={manager}
              isAdmin={isAdmin}
              onSignOut={onSignOut}
            />
          )}
          
          <NotificationCenter />
          <Button
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            title="Se déconnecter"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
