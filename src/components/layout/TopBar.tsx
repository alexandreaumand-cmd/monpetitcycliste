import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManagerDropdown } from "./ManagerDropdown";

interface TopBarProps {
  onSignOut: () => void;
  manager: any;
  isAdmin: boolean;
}

export function TopBar({ onSignOut, manager, isAdmin }: TopBarProps) {
  const { seasons, selectedSeason, setSelectedSeason } = useSeasonContext();
  const { leagueId } = useLeague();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        {/* League and Season selectors on the left */}
        <div className="flex items-center gap-3">
          {/* League Switcher */}
          <LeagueSwitcher />
          
          {/* Season Selector - masqué si dans une ligue */}
          {!leagueId && (
            <Select value={selectedSeason?.id} onValueChange={(value) => {
              const season = seasons.find(s => s.id === value);
              if (season) setSelectedSeason(season);
            }}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Saison" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
