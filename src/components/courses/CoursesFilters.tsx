import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface CoursesFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  phaseFilter: string;
  onPhaseFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  phases: Array<{ index_dans_saison: number }>;
}

export const CoursesFilters = ({
  searchTerm,
  onSearchChange,
  phaseFilter,
  onPhaseFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  phases,
}: CoursesFiltersProps) => {
  const categories = [
    "WT GT", "WT Monument", "Classiques WT Cat 1", "WT Cat 1", 
    "WT Cat 2", "Pro Series", "1.Pro", "2.Pro", "1.1", "1.2", "2.1", "2.2"
  ];

  return (
    <div className="space-y-4 p-4 bg-card border rounded-lg">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="search">Rechercher</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Nom de la course..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phase">Phase</Label>
          <Select value={phaseFilter} onValueChange={onPhaseFilterChange}>
            <SelectTrigger id="phase">
              <SelectValue placeholder="Toutes les phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les phases</SelectItem>
              {phases.map((phase) => (
                <SelectItem key={phase.index_dans_saison} value={String(phase.index_dans_saison)}>
                  Phase {phase.index_dans_saison}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Catégorie</Label>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="One day">Course d'un jour</SelectItem>
              <SelectItem value="Stage race">Course par étapes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort">Trier par</Label>
          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger id="sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days_until">Proximité</SelectItem>
              <SelectItem value="points_total">Points max</SelectItem>
              <SelectItem value="date_debut">Date de début</SelectItem>
              <SelectItem value="categorie">Catégorie</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
