import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";

interface CoureursFiltersProps {
  filters: {
    saison_ids: string[];
    search: string;
    equipe_ids: string[];
    cote_ranges: string[];
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
    queryKey: ['equipes-saisons-filter', filters.saison_ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, nom_affiche, equipes!inner(code_court)')
        .then(async (result) => {
          if (filters.saison_ids.length > 0) {
            return supabase
              .from('equipes_saisons')
              .select('equipe_id, nom_affiche, equipes!inner(code_court)')
              .in('saison_id', filters.saison_ids)
              .order('nom_affiche');
          }
          return supabase
            .from('equipes_saisons')
            .select('equipe_id, nom_affiche, equipes!inner(code_court)')
            .order('nom_affiche')
            .limit(1000);
        });
      
      const { data: finalData, error: finalError } = await (filters.saison_ids.length > 0
        ? supabase
            .from('equipes_saisons')
            .select('equipe_id, nom_affiche, equipes!inner(code_court)')
            .in('saison_id', filters.saison_ids)
            .order('nom_affiche')
        : supabase
            .from('equipes_saisons')
            .select('equipe_id, nom_affiche, equipes!inner(code_court)')
            .order('nom_affiche')
            .limit(1000));
      
      if (finalError) throw finalError;
      
      // Remove duplicates by equipe_id
      const uniqueEquipes = finalData?.reduce((acc, curr) => {
        if (!acc.find(e => e.equipe_id === curr.equipe_id)) {
          acc.push(curr);
        }
        return acc;
      }, [] as typeof finalData) || [];
      
      return uniqueEquipes;
    },
  });

  const saisonOptions: MultiSelectOption[] = saisons?.map(s => ({
    value: s.id,
    label: `Saison ${s.annee}`,
  })) || [];

  const equipeOptions: MultiSelectOption[] = equipes?.map(eq => ({
    value: eq.equipe_id,
    label: `${eq.nom_affiche} (${eq.equipes.code_court})`,
  })) || [];

  const coteOptions: MultiSelectOption[] = [
    { value: "10-30", label: "10-30 (Domestiques)" },
    { value: "40-60", label: "40-60 (Bons coureurs)" },
    { value: "70-90", label: "70-90 (Très bons coureurs)" },
    { value: "100-120", label: "100-120 (Leaders)" },
    { value: "130-150", label: "130-150 (Stars)" },
    { value: "150+", label: "150+ (Super-stars)" },
  ];

  const handleReset = () => {
    onFiltersChange({
      saison_ids: [],
      search: "",
      equipe_ids: [],
      cote_ranges: [],
    });
  };

  const totalFilters = 
    filters.saison_ids.length + 
    filters.equipe_ids.length + 
    filters.cote_ranges.length +
    (filters.search ? 1 : 0);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saisons */}
          <MultiSelect
            options={saisonOptions}
            selected={filters.saison_ids}
            onChange={(selected) => onFiltersChange({ ...filters, saison_ids: selected, equipe_ids: [] })}
            placeholder="Toutes les saisons"
          />

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

          {/* Équipes */}
          <MultiSelect
            options={equipeOptions}
            selected={filters.equipe_ids}
            onChange={(selected) => onFiltersChange({ ...filters, equipe_ids: selected })}
            placeholder="Toutes les équipes"
          />

          {/* Côtes */}
          <MultiSelect
            options={coteOptions}
            selected={filters.cote_ranges}
            onChange={(selected) => onFiltersChange({ ...filters, cote_ranges: selected })}
            placeholder="Toutes les côtes"
          />
        </div>

        {/* Summary and reset */}
        {totalFilters > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {filters.saison_ids.length > 0 && (
                <Badge variant="secondary">
                  {filters.saison_ids.length} saison{filters.saison_ids.length > 1 ? 's' : ''}
                </Badge>
              )}
              {filters.equipe_ids.length > 0 && (
                <Badge variant="secondary">
                  {filters.equipe_ids.length} équipe{filters.equipe_ids.length > 1 ? 's' : ''}
                </Badge>
              )}
              {filters.cote_ranges.length > 0 && (
                <Badge variant="secondary">
                  {filters.cote_ranges.length} plage{filters.cote_ranges.length > 1 ? 's' : ''} de côtes
                </Badge>
              )}
              {filters.search && (
                <Badge variant="secondary">
                  Recherche active
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
