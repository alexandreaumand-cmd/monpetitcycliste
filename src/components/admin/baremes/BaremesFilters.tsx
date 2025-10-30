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
  { value: "WT GT", label: "WT GT" },
  { value: "Classiques WT Cat 1", label: "Classiques WT Cat 1" },
  { value: "Classiques WT Cat 2", label: "Classiques WT Cat 2" },
  { value: "Classiques WT Cat 3", label: "Classiques WT Cat 3" },
  { value: "Tours WT Cat 1", label: "Tours WT Cat 1" },
  { value: "Tours WT Cat 2", label: "Tours WT Cat 2" },
  { value: "Tours WT Cat 3", label: "Tours WT Cat 3" },
  { value: "1.1", label: "1.1" },
  { value: "1.pro", label: "1.pro" },
  { value: "2.1", label: "2.1" },
  { value: "2.pro", label: "2.pro" },
  { value: "CN_ITT Cat 1", label: "CN ITT Cat 1" },
  { value: "CN_ITT Cat 2", label: "CN ITT Cat 2" },
  { value: "CN_ITT Cat 3", label: "CN ITT Cat 3" },
  { value: "CN_ITT Cat 4", label: "CN ITT Cat 4" },
  { value: "CN_RR Cat 1", label: "CN RR Cat 1" },
  { value: "CN_RR Cat 2", label: "CN RR Cat 2" },
  { value: "CN_RR Cat 3", label: "CN RR Cat 3" },
  { value: "CN_RR Cat 4", label: "CN RR Cat 4" },
  { value: "EC ITT", label: "EC ITT" },
  { value: "EC RR", label: "EC RR" },
  { value: "WC ITT", label: "WC ITT" },
  { value: "WC RR", label: "WC RR" },
];

const typeClassements = [
  { value: "all", label: "Tous les types" },
  { value: "General", label: "Général" },
  { value: "Etape", label: "Étape" },
  { value: "Points", label: "Points" },
  { value: "Montagne", label: "Montagne" },
  { value: "Jeune", label: "Jeune" },
  { value: "Combatif", label: "Combativité" },
  { value: "Porteur Général", label: "🟡 Porteur Jaune" },
  { value: "Porteur Vert", label: "🟢 Porteur Vert" },
  { value: "Porteur Montagne", label: "🔴 Porteur Pois" },
  { value: "Porteur Jeune", label: "⚪ Porteur Blanc" },
  { value: "Porteur Combattif", label: "🔵 Porteur Combativité" },
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
