import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, X, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FiltersDrawerProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  selectedCotes: number[];
  onCotesChange: (cotes: number[]) => void;
  availableTeams: { short: string; full: string }[];
}

export function FiltersDrawer({
  searchQuery,
  onSearchChange,
  selectedTeams,
  onTeamsChange,
  selectedCotes,
  onCotesChange,
  availableTeams,
}: FiltersDrawerProps) {
  const toggleTeam = (team: string) => {
    if (selectedTeams.includes(team)) {
      onTeamsChange(selectedTeams.filter(t => t !== team));
    } else {
      onTeamsChange([...selectedTeams, team]);
    }
  };

  const selectAllTeams = () => {
    onTeamsChange(availableTeams.map(t => t.short));
  };

  const clearAllTeams = () => {
    onTeamsChange([]);
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

  const clearAllFilters = () => {
    onSearchChange("");
    onTeamsChange([]);
    onCotesChange([]);
  };

  const hasActiveFilters = searchQuery || selectedTeams.length > 0 || selectedCotes.length > 0;
  const activeFiltersCount = (searchQuery ? 1 : 0) + (selectedTeams.length > 0 ? 1 : 0) + (selectedCotes.length > 0 ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg z-20"
        >
          <Filter className="h-5 w-5" />
          {hasActiveFilters && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <SheetTitle>Filtres de recherche</SheetTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 text-xs"
              >
                Tout effacer
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-full py-4">
          <div className="space-y-4 px-1 pb-20">
            {/* Search bar */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Recherche</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nom du coureur…"
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
            </div>

            {/* Team Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Équipes {selectedTeams.length > 0 && `(${selectedTeams.length})`}
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllTeams}
                    className="h-6 text-xs"
                  >
                    Tout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllTeams}
                    className="h-6 text-xs"
                  >
                    Aucun
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {availableTeams.map((team) => (
                  <div
                    key={team.short}
                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => toggleTeam(team.short)}
                  >
                    <Checkbox
                      checked={selectedTeams.includes(team.short)}
                      onCheckedChange={() => toggleTeam(team.short)}
                    />
                    <label className="flex-1 text-sm cursor-pointer">
                      {team.short} - {team.full}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Côtes {selectedCotes.length > 0 && `(${selectedCotes.length})`}
              </label>
              <div className="flex flex-wrap gap-2">
                {coteOptions.map((cote) => (
                  <Badge
                    key={cote}
                    variant={selectedCotes.includes(cote) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/10 transition-colors text-xs px-2 py-1"
                    onClick={() => toggleCote(cote)}
                  >
                    {getCoteLabel(cote)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
