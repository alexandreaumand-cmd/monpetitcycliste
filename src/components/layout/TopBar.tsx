import { NotificationCenter } from "./NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManagerDropdown } from "./ManagerDropdown";
import { useLeague } from "@/contexts/LeagueContext";

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
        
        {/* League selector with integrated metadata */}
        <div className="flex items-center gap-3">
          <LeagueSwitcher />
          
          {/* Season Selector - only visible when NO league is selected */}
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
        
        {/* Flexible spacer */}
        <div className="flex-1" />
        
        {/* Manager dropdown and Notifications on the right */}
        <div className="flex items-center gap-2">
          {manager && (
            <ManagerDropdown 
              manager={manager}
              isAdmin={isAdmin}
              onSignOut={onSignOut}
              avatarUrl={manager.avatar_url}
            />
          )}
          
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
}
