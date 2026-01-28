import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { isSuperAdmin: false, isLeagueAdminOnly: false };
      }

      // Check for superadmin role
      const { data: isSuperAdminData, error } = await supabase.rpc('is_superadmin');
      
      if (error) {
        console.error("Error checking superadmin role:", error);
        return { isSuperAdmin: false, isLeagueAdminOnly: false };
      }
      
      const isSuperAdmin = isSuperAdminData || false;
      
      if (isSuperAdmin) {
        return { isSuperAdmin: true, isLeagueAdminOnly: false };
      }
      
      // If not superadmin, check if user is league admin
      const { data: memberships } = await supabase
        .from('league_members')
        .select('role_in_league')
        .eq('user_id', session.user.id)
        .in('role_in_league', ['owner', 'admin']);
      
      const hasLeagueAdminRole = (memberships?.length || 0) > 0;
      
      return { 
        isSuperAdmin: false, 
        isLeagueAdminOnly: hasLeagueAdminRole 
      };
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["user-role"] });
  };

  return {
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isLeagueAdminOnly: data?.isLeagueAdminOnly ?? false,
    isAdmin: (data?.isSuperAdmin || data?.isLeagueAdminOnly) ?? false,
    loading: isLoading,
    refetch,
  };
};
