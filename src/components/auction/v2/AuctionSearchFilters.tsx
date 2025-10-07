import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

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
  const handleTeamChange = (value: string) => {
    if (value === "all") {
      onTeamsChange([]);
    } else {
      onTeamsChange([value]);
    }
  };

  const handleCoteChange = (value: string) => {
    switch (value) {
      case "all":
        onCoteRangeChange([0, 500]);
        break;
      case "0-50":
        onCoteRangeChange([0, 50]);
        break;
      case "50-100":
        onCoteRangeChange([50, 100]);
        break;
      case "100-150":
        onCoteRangeChange([100, 150]);
        break;
      case "150-200":
        onCoteRangeChange([150, 200]);
        break;
      case "200+":
        onCoteRangeChange([200, 500]);
        break;
    }
  };

  const getCoteValue = () => {
    const [min, max] = coteRange;
    if (min === 0 && max === 500) return "all";
    if (min === 0 && max === 50) return "0-50";
    if (min === 50 && max === 100) return "50-100";
    if (min === 100 && max === 150) return "100-150";
    if (min === 150 && max === 200) return "150-200";
    if (min === 200 && max === 500) return "200+";
    return "all";
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

      {/* Filters */}
      <div className="flex gap-2">
        <Select
          value={selectedTeams.length === 0 ? "all" : selectedTeams[0]}
          onValueChange={handleTeamChange}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Toutes les équipes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les équipes</SelectItem>
            {availableTeams.map((team) => (
              <SelectItem key={team} value={team}>
                {team}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={getCoteValue()} onValueChange={handleCoteChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Toutes les côtes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les côtes</SelectItem>
            <SelectItem value="0-50">0 - 50€</SelectItem>
            <SelectItem value="50-100">50 - 100€</SelectItem>
            <SelectItem value="100-150">100 - 150€</SelectItem>
            <SelectItem value="150-200">150 - 200€</SelectItem>
            <SelectItem value="200+">200€+</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
