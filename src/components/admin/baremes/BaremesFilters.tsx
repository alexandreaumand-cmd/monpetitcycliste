import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface BaremesFiltersProps {
  saisons: any[];
  filters: {
    saison_id: string;
    categorie: string;
    type_classement: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
}

const categories = [
  { value: "all", label: "Toutes les catégories" },
  { value: "WT Monument", label: "WT Monument" },
  { value: "WT Grand Tour", label: "WT Grand Tour" },
  { value: "WT Stage Race", label: "WT Stage Race" },
  { value: "WT One-Day", label: "WT One-Day" },
  { value: "UCI ProSeries", label: "UCI ProSeries" },
  { value: "UCI 1", label: "UCI Classe 1" },
  { value: "UCI 2", label: "UCI Classe 2" },
  { value: "Championnats", label: "Championnats" },
];

const typeClassements = [
  { value: "all", label: "Tous les types" },
  { value: "general", label: "Classement Général" },
  { value: "etape", label: "Étape" },
  { value: "points", label: "Points" },
  { value: "montagne", label: "Montagne" },
  { value: "jeune", label: "Jeune" },
];

export function BaremesFilters({ saisons, filters, onFilterChange, onReset }: BaremesFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <Select value={filters.saison_id} onValueChange={(value) => onFilterChange('saison_id', value)}>
        <SelectTrigger className="w-full md:w-[250px]">
          <SelectValue placeholder="Saison" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les saisons</SelectItem>
          {saisons?.map((saison) => (
            <SelectItem key={saison.id} value={saison.id}>
              {saison.annee}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.categorie} onValueChange={(value) => onFilterChange('categorie', value)}>
        <SelectTrigger className="w-full md:w-[250px]">
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type_classement} onValueChange={(value) => onFilterChange('type_classement', value)}>
        <SelectTrigger className="w-full md:w-[250px]">
          <SelectValue placeholder="Type de classement" />
        </SelectTrigger>
        <SelectContent>
          {typeClassements.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="default" onClick={onReset}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Réinitialiser
      </Button>
    </div>
  );
}
