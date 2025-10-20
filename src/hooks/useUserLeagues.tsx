import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { League, LeagueWithRole } from "@/lib/leagues/types";

export function useUserLeagues() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user-leagues'],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch leagues where user is a member
      const { data: memberships, error: membershipsError } = await supabase
        .from('league_members')
        .select(`
          league_id,
          role_in_league,
          leagues:league_id (
            id,
            name,
            visibility,
            owner_manager_id,
            settings,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (membershipsError) {
        throw membershipsError;
      }

      // Transform data
      const leagues: LeagueWithRole[] = (memberships || [])
        .filter(m => m.leagues)
        .map(m => ({
          ...(m.leagues as any),
          role: m.role_in_league,
        }));

      const roles: Record<string, 'owner' | 'admin' | 'member'> = {};
      memberships?.forEach(m => {
        if (m.league_id && m.role_in_league) {
          roles[m.league_id] = m.role_in_league as 'owner' | 'admin' | 'member';
        }
      });

      return { leagues, roles };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    leagues: data?.leagues || [],
    roles: data?.roles || {},
    isLoading,
    error,
    refetch,
  };
}
