import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLeagueAdminOnly, setIsLeagueAdminOnly] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Kept for backward compatibility
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsSuperAdmin(false);
        setIsLeagueAdminOnly(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Check for superadmin role
      const { data, error } = await supabase.rpc('is_superadmin');
      
      if (error) {
        console.error("Error checking superadmin role:", error);
        setIsSuperAdmin(false);
        setIsLeagueAdminOnly(false);
        setIsAdmin(false);
      } else {
        const isSuperAdminValue = data || false;
        setIsSuperAdmin(isSuperAdminValue);
        
        // If not superadmin, check if user is league admin
        if (!isSuperAdminValue) {
          const { data: memberships } = await supabase
            .from('league_members')
            .select('role_in_league')
            .eq('user_id', session.user.id)
            .in('role_in_league', ['owner', 'admin']);
          
          const hasLeagueAdminRole = (memberships?.length || 0) > 0;
          setIsLeagueAdminOnly(hasLeagueAdminRole);
          setIsAdmin(hasLeagueAdminRole); // For backward compatibility
        } else {
          setIsLeagueAdminOnly(false);
          setIsAdmin(true); // For backward compatibility
        }
      }
    } catch (error) {
      console.error("Error checking role:", error);
      setIsSuperAdmin(false);
      setIsLeagueAdminOnly(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isSuperAdmin, isLeagueAdminOnly, isAdmin, loading, refetch: checkRole };
};
