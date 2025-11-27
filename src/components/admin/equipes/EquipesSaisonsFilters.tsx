import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EquipesSaisonsFiltersProps {
  filters: {
    saison_id: string;
    search: string;
    categorie: string;
  };
  onFiltersChange: (filters: any) => void;
  onCreateClick: () => void;
}

export const EquipesSaisonsFilters = ({ filters, onFiltersChange, onCreateClick }: EquipesSaisonsFiltersProps) => {
  const { data: saisons } = useQuery({
    queryKey: ['saisons-for-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      return data || [];
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Filtres</h3>
          <Button onClick={onCreateClick} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Créer une équipe
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Saison */}
          <Select
            value={filters.saison_id}
            onValueChange={(value) => onFiltersChange({ ...filters, saison_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une saison *" />
            </SelectTrigger>
            <SelectContent>
              {saisons?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Saison {s.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une équipe..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-9"
              disabled={!filters.saison_id}
            />
          </div>

          {/* Catégorie */}
          <Select
            value={filters.categorie}
            onValueChange={(value) => onFiltersChange({ ...filters, categorie: value })}
            disabled={!filters.saison_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              <SelectItem value="none">Aucune catégorie</SelectItem>
              <SelectItem value="WT">WorldTeam</SelectItem>
              <SelectItem value="PT">ProTeam</SelectItem>
              <SelectItem value="CT">Continental</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
