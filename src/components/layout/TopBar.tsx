import { LogOut, Trophy, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManagerDropdown } from "./ManagerDropdown";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { LEAGUE_TEMPLATES } from "@/lib/leagues/templates";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  onSignOut: () => void;
  manager: any;
  isAdmin: boolean;
}

export function TopBar({ onSignOut, manager, isAdmin }: TopBarProps) {
  const { seasons, selectedSeason, setSelectedSeason, isLeagueSeason } = useSeasonContext();
  const { leagueId } = useLeague();
  const { leagues } = useUserLeagues();
  
  const currentLeague = leagues.find(l => l.id === leagueId);
  const gameMode = currentLeague?.game_mode;
  const gameModeTemplate = gameMode 
    ? LEAGUE_TEMPLATES.find(t => t.id === gameMode) 
    : null;
  
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        {/* League selector on the left */}
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
        
        {/* Espacement gauche */}
        <div className="flex-1" />
        
        {/* Badges informatifs au centre - visible uniquement si une ligue est sélectionnée */}
        {currentLeague && (
          <div className="flex items-center gap-2">
            {gameModeTemplate && (
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <Trophy className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{gameModeTemplate.name}</span>
              </Badge>
            )}
            
            {selectedSeason && (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Saison {selectedSeason.annee}</span>
              </Badge>
            )}
          </div>
        )}
        
        {/* Espacement droit */}
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
