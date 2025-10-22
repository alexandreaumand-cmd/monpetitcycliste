import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeagueMemberCount(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-member-count', leagueId],
    queryFn: async () => {
      if (!leagueId) return 0;

      const { count, error } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!leagueId,
  });
}
