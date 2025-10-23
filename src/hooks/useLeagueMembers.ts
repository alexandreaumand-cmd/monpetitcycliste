import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeagueMembers(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-members', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      const { data, error } = await supabase
        .from('league_members')
        .select(`
          id,
          joined_at,
          user_id
        `)
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      // Fetch manager names separately via user_id
      const userIds = data?.map(m => m.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: managers, error: managersError } = await supabase
        .from('managers')
        .select('user_id, nom')
        .in('user_id', userIds);

      if (managersError) throw managersError;

      // Map managers to members
      const managerMap = new Map(managers?.map(m => [m.user_id, m.nom]) || []);
      
      return data?.map(m => ({
        id: m.id,
        name: managerMap.get(m.user_id) || 'Inconnu',
        joinedAt: m.joined_at
      })) || [];
    },
    enabled: !!leagueId,
  });
}
