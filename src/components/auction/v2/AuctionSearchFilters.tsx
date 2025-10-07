import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

interface AuctionSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  selectedCotes: number[];
  onCotesChange: (cotes: number[]) => void;
  availableTeams: { short: string; full: string }[];
}

export function AuctionSearchFilters({
  searchQuery,
  onSearchChange,
  selectedTeams,
  onTeamsChange,
  selectedCotes,
  onCotesChange,
  availableTeams,
}: AuctionSearchFiltersProps) {
  const toggleTeam = (team: string) => {
    if (selectedTeams.includes(team)) {
      onTeamsChange(selectedTeams.filter(t => t !== team));
    } else {
      onTeamsChange([...selectedTeams, team]);
    }
  };

  const coteOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 101]; // 101 represents 100+
  
  const toggleCote = (cote: number) => {
    if (selectedCotes.includes(cote)) {
      onCotesChange(selectedCotes.filter(c => c !== cote));
    } else {
      onCotesChange([...selectedCotes, cote]);
    }
  };

  const getCoteLabel = (cote: number) => {
    if (cote === 101) return "100+";
    return `${cote}`;
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

      {/* Team Filter */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Filtrer par équipe</div>
        <div className="flex flex-wrap gap-1.5">
          {availableTeams.map((team) => (
            <Badge
              key={team.short}
              variant={selectedTeams.includes(team.short) ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
              onClick={() => toggleTeam(team.short)}
            >
              {team.short}
            </Badge>
          ))}
        </div>
      </div>

      {/* Price Filter */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Filtrer par côte</div>
        <div className="flex flex-wrap gap-1.5">
          {coteOptions.map((cote) => (
            <Badge
              key={cote}
              variant={selectedCotes.includes(cote) ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => toggleCote(cote)}
            >
              {getCoteLabel(cote)}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
