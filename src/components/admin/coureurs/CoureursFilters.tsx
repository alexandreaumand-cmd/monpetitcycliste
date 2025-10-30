import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CoureursFiltersProps {
  filters: {
    saison_id: string;
    search: string;
    equipe: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const CoureursFilters = ({ filters, onFiltersChange }: CoureursFiltersProps) => {
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

  const { data: equipes } = useQuery({
    queryKey: ['equipes-saisons-filter', filters.saison_id],
    queryFn: async () => {
      if (!filters.saison_id) return [];

      const { data, error } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, nom_affiche, equipes!inner(code_court)')
        .eq('saison_id', filters.saison_id)
        .order('nom_affiche');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!filters.saison_id,
  });

  return (
    <Card>
      <CardContent className="pt-6">
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
              placeholder="Rechercher un coureur..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>

          {/* Équipe */}
          <Select
            value={filters.equipe}
            onValueChange={(value) => onFiltersChange({ ...filters, equipe: value })}
            disabled={!filters.saison_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Toutes les équipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les équipes</SelectItem>
              {equipes?.map((eq) => (
                <SelectItem key={eq.equipe_id} value={eq.equipe_id}>
                  {eq.nom_affiche} ({eq.equipes.code_court})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
