import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

import { Search, X, ChevronDown } from "lucide-react";

interface AuctionSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  selectedCotes: number[];
  onCotesChange: (cotes: number[]) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  availableTeams: Array<{ id: string; name: string; categorie?: string }>;
}

export function AuctionSearchFilters({
  searchQuery,
  onSearchChange,
  selectedTeams,
  onTeamsChange,
  selectedCotes,
  onCotesChange,
  selectedCategories,
  onCategoriesChange,
  availableTeams,
}: AuctionSearchFiltersProps) {
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  const categorieOptions = [
    { value: "WT", label: "WorldTeam" },
    { value: "PT", label: "ProTeam" },
    { value: "CT", label: "Continental" },
  ];

  const toggleTeam = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      onTeamsChange(selectedTeams.filter(t => t !== teamId));
    } else {
      onTeamsChange([...selectedTeams, teamId]);
    }
  };

  const selectAllTeams = () => {
    onTeamsChange(availableTeams.map(t => t.id));
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

  const toggleCategorie = (categorie: string) => {
    if (selectedCategories.includes(categorie)) {
      onCategoriesChange(selectedCategories.filter(c => c !== categorie));
    } else {
      onCategoriesChange([...selectedCategories, categorie]);
    }
  };

  // Filter teams based on search query and selected categories
  const filteredTeams = availableTeams.filter(team => {
    const matchesSearch = team?.name?.toLowerCase().includes(teamSearchQuery.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || 
      (team.categorie && selectedCategories.includes(team.categorie));
    return matchesSearch && matchesCategory;
  });

  // Get team names to display in the button
  const getSelectedTeamNames = () => {
    return selectedTeams
      .map(id => availableTeams.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="flex items-center gap-3">
      {/* Search bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un coureur…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-10 h-10"
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

      {/* Team Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Catégorie:</span>
        {categorieOptions.map((cat) => (
          <Badge
            key={cat.value}
            variant={selectedCategories.includes(cat.value) ? "default" : "outline"}
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => toggleCategorie(cat.value)}
          >
            {cat.label}
          </Badge>
        ))}
      </div>

      {/* Team Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="h-10 min-w-[140px] justify-between font-normal"
          >
            <span className="truncate">
              {selectedTeams.length === 0 
                ? "Équipes" 
                : selectedTeams.length <= 2 
                  ? getSelectedTeamNames()
                  : `${selectedTeams.length} équipes`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-white dark:bg-gray-800 z-50" align="start">
          {/* Header with search and actions */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Équipes ({selectedTeams.length})</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllTeams} className="h-6 text-xs">
                  Tout
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllTeams} className="h-6 text-xs">
                  Aucun
                </Button>
              </div>
            </div>
            <Input
              type="text"
              placeholder="Rechercher une équipe..."
              value={teamSearchQuery}
              onChange={(e) => setTeamSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          {/* Scrollable team list */}
          <div className="max-h-[500px] overflow-y-auto p-2 space-y-1">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                onClick={() => toggleTeam(team.id)}
              >
                <Checkbox checked={selectedTeams.includes(team.id)} />
                <span className="flex-1 text-sm">{team.name}</span>
              </div>
            ))}
            {filteredTeams.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Aucune équipe trouvée
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Price Filter - All badges inline */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Prix:</span>
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
        {selectedCotes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCotesChange([])}
            className="h-6 px-2 text-xs"
          >
            Effacer
          </Button>
        )}
      </div>
    </div>
  );
}
