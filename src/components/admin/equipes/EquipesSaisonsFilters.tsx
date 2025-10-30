import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EquipesSaisonsFiltersProps {
  filters: {
    saison_id: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const EquipesSaisonsFilters = ({ filters, onFiltersChange }: EquipesSaisonsFiltersProps) => {
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
        <div className="flex items-center gap-4">
          <Select
            value={filters.saison_id}
            onValueChange={(value) => onFiltersChange({ ...filters, saison_id: value })}
          >
            <SelectTrigger className="w-[300px]">
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
        </div>
      </CardContent>
    </Card>
  );
};
