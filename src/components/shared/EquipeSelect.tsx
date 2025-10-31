import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EquipeSelectProps {
  saisonId: string;
  value?: string;
  onChange: (equipeId: string) => void;
  placeholder?: string;
  preloadedEquipes?: any[];
}

export const EquipeSelect = ({
  saisonId,
  value,
  onChange,
  placeholder = "Sélectionner une équipe",
  preloadedEquipes
}: EquipeSelectProps) => {
  const { data: fetchedEquipes, isLoading: isFetching } = useQuery({
    queryKey: ['equipes-saisons-select', saisonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, nom_affiche, equipes!inner(code_court, nom_complet)')
        .eq('saison_id', saisonId)
        .order('nom_affiche');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!saisonId && !preloadedEquipes,
  });

  // Utiliser les équipes pré-chargées si disponibles, sinon les données fetchées
  const equipes = preloadedEquipes 
    ? preloadedEquipes.filter(e => e.saison_id === saisonId)
    : fetchedEquipes;
  
  const isLoading = !preloadedEquipes && isFetching;

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Chargement..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {equipes?.map((eq) => (
          <SelectItem key={eq.equipe_id} value={eq.equipe_id}>
            {eq.nom_affiche} ({eq.equipes.code_court})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
