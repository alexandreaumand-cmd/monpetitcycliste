import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Manager {
  id: string;
  nom: string;
}

interface ManagerSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export const ManagerSelect = ({ value, onValueChange, placeholder = "Sélectionner un manager..." }: ManagerSelectProps) => {
  const { data: managers, isLoading } = useQuery({
    queryKey: ['managers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers')
        .select('id, nom')
        .order('nom');
      
      if (error) throw error;
      return data as Manager[];
    },
  });

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {managers?.map((manager) => (
          <SelectItem key={manager.id} value={manager.id}>
            {manager.nom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
