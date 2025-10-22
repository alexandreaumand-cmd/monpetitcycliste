import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TopBarProps {
  onSignOut: () => void;
  manager: any;
  isAdmin: boolean;
}

export function TopBar({ onSignOut, manager, isAdmin }: TopBarProps) {
  const { seasons, selectedSeason, setSelectedSeason } = useSeasonContext();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        {/* Contexte Section */}
        <div className="flex items-center gap-4">
          {/* Manager Info */}
          {manager && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{manager.nom_manager}</span>
              {manager.sponsor && (
                <span className="text-xs text-muted-foreground">({manager.sponsor})</span>
              )}
              {isAdmin && <Badge variant="secondary" className="text-xs">Admin</Badge>}
            </div>
          )}
          
          {/* Season Selector */}
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
          
          {/* League Switcher */}
          <LeagueSwitcher />
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
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
