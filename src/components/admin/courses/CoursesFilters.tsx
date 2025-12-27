import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CoursesFiltersProps {
  filters: {
    phase_id: string;
    saison_id: string;
    statut: string;
    search: string;
    categorie: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const CoursesFilters = ({ filters, onFiltersChange }: CoursesFiltersProps) => {
  const { data: phases } = useQuery({
    queryKey: ['phases-for-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('phases')
        .select('id, index_dans_saison, saisons(annee)')
        .order('date_debut', { ascending: false });
      return data || [];
    },
  });

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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une course..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>

          {/* Saison */}
          <Select
            value={filters.saison_id}
            onValueChange={(value) => onFiltersChange({ ...filters, saison_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Toutes les saisons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les saisons</SelectItem>
              {saisons?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Saison {s.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Phase */}
          <Select
            value={filters.phase_id}
            onValueChange={(value) => onFiltersChange({ ...filters, phase_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Toutes les phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les phases</SelectItem>
              {phases?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Phase {p.index_dans_saison} - {p.saisons?.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Statut */}
          <Select
            value={filters.statut}
            onValueChange={(value) => onFiltersChange({ ...filters, statut: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="scheduled">Programmé</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
            </SelectContent>
          </Select>

          {/* Catégorie */}
          <Select
            value={filters.categorie}
            onValueChange={(value) => onFiltersChange({ ...filters, categorie: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">Toutes les catégories</SelectItem>
              
              {/* WorldTour */}
              <SelectItem value="WT Monument">WT Monument</SelectItem>
              <SelectItem value="WT GT">WT GT</SelectItem>
              <SelectItem value="Tours WT Cat 1">Tours WT Cat 1</SelectItem>
              <SelectItem value="Tours WT Cat 2">Tours WT Cat 2</SelectItem>
              <SelectItem value="Tours WT Cat 3">Tours WT Cat 3</SelectItem>
              <SelectItem value="Classiques WT Cat 1">Classiques WT Cat 1</SelectItem>
              <SelectItem value="Classiques WT Cat 2">Classiques WT Cat 2</SelectItem>
              <SelectItem value="Classiques WT Cat 3">Classiques WT Cat 3</SelectItem>
              
              {/* UCI */}
              <SelectItem value="1.1">1.1</SelectItem>
              <SelectItem value="1.pro">1.pro</SelectItem>
              <SelectItem value="2.1">2.1</SelectItem>
              <SelectItem value="2.pro">2.pro</SelectItem>
              
              {/* Championnats */}
              <SelectItem value="CN">CN</SelectItem>
              <SelectItem value="CN_RR Cat 1">CN_RR Cat 1</SelectItem>
              <SelectItem value="CN_RR Cat 2">CN_RR Cat 2</SelectItem>
              <SelectItem value="CN_RR Cat 3">CN_RR Cat 3</SelectItem>
              <SelectItem value="CN_RR Cat 4">CN_RR Cat 4</SelectItem>
              <SelectItem value="CN_ITT Cat 1">CN_ITT Cat 1</SelectItem>
              <SelectItem value="CN_ITT Cat 2">CN_ITT Cat 2</SelectItem>
              <SelectItem value="CN_ITT Cat 3">CN_ITT Cat 3</SelectItem>
              <SelectItem value="CN_ITT Cat 4">CN_ITT Cat 4</SelectItem>
              <SelectItem value="EC ITT">EC ITT</SelectItem>
              <SelectItem value="EC RR">EC RR</SelectItem>
              <SelectItem value="WC ITT">WC ITT</SelectItem>
              <SelectItem value="WC RR">WC RR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
