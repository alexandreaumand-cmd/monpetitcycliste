import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface AuctionSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  coteRange: [number, number];
  onCoteRangeChange: (range: [number, number]) => void;
  availableTeams: string[];
}

export function AuctionSearchFilters({
  searchQuery,
  onSearchChange,
  selectedTeams,
  onTeamsChange,
  coteRange,
  onCoteRangeChange,
  availableTeams,
}: AuctionSearchFiltersProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const toggleTeam = (team: string) => {
    if (selectedTeams.includes(team)) {
      onTeamsChange(selectedTeams.filter(t => t !== team));
    } else {
      onTeamsChange([...selectedTeams, team]);
    }
  };

  const clearTeams = () => onTeamsChange([]);

  const setCotePreset = (min: number, max: number) => {
    onCoteRangeChange([min, max]);
  };

  return (
    <div className="space-y-3 p-4 border-b bg-muted/30">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un coureur…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filters toggle */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filtres avancés
            {(selectedTeams.length > 0 || coteRange[0] > 0 || coteRange[1] < 500) && (
              <Badge variant="secondary" className="ml-2">
                {selectedTeams.length > 0 ? selectedTeams.length : ""}
                {selectedTeams.length > 0 && (coteRange[0] > 0 || coteRange[1] < 500) ? " + " : ""}
                {(coteRange[0] > 0 || coteRange[1] < 500) ? "côte" : ""}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 pt-4">
          {/* Team filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Équipes</label>
              {selectedTeams.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearTeams}
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Effacer
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTeams.slice(0, 12).map((team) => (
                <Badge
                  key={team}
                  variant={selectedTeams.includes(team) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTeam(team)}
                >
                  {team}
                </Badge>
              ))}
            </div>
          </div>

          {/* Cote filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Côte (prix initial)</label>
            
            {/* Quick presets */}
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setCotePreset(0, 50)}
              >
                ≤ 50€
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setCotePreset(50, 100)}
              >
                50-100€
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setCotePreset(100, 500)}
              >
                ≥ 100€
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setCotePreset(0, 500)}
              >
                Tous
              </Badge>
            </div>

            {/* Range slider */}
            <div className="space-y-2 px-2">
              <Slider
                value={coteRange}
                onValueChange={(value) => onCoteRangeChange(value as [number, number])}
                min={0}
                max={500}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{coteRange[0]}€</span>
                <span>{coteRange[1]}€</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
