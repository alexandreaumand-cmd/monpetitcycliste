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
  leagueId?: string | null;
}

export const ManagerSelect = ({ value, onValueChange, placeholder = "Sélectionner un manager...", leagueId }: ManagerSelectProps) => {
  const { data: managers, isLoading } = useQuery({
    queryKey: ['managers-list', leagueId],
    queryFn: async () => {
      // Si pas de leagueId, retourner tous les managers
      if (!leagueId) {
        const { data, error } = await supabase
          .from('managers')
          .select('id, nom')
          .order('nom');
        
        if (error) throw error;
        return data as Manager[];
      }
      
      // Filtrer par ligue si leagueId fourni - méthode principale via league_members
      const { data: leagueMembers, error: membersError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);
      
      if (membersError) throw membersError;
      
      // Si league_members est vide, fallback via rosters (pour legacy league)
      if (!leagueMembers || leagueMembers.length === 0) {
        console.log('No league_members found, using rosters fallback for league:', leagueId);
        
        const { data: rosterManagers, error: rostersError } = await supabase
          .from('rosters')
          .select('manager_id')
          .eq('league_id', leagueId);
        
        if (rostersError) throw rostersError;
        if (!rosterManagers || rosterManagers.length === 0) return [];
        
        const managerIds = Array.from(new Set(rosterManagers.map(r => r.manager_id)));
        
        const { data, error } = await supabase
          .from('managers')
          .select('id, nom')
          .in('id', managerIds)
          .order('nom');
        
        if (error) throw error;
        return data as Manager[];
      }
      
      const userIds = leagueMembers.map(m => m.user_id);
      
      const { data, error } = await supabase
        .from('managers')
        .select('id, nom')
        .in('user_id', userIds)
        .order('nom');
      
      if (error) throw error;
      return data as Manager[];
    },
    enabled: leagueId !== undefined,
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
