import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Check for superadmin role
      const { data, error } = await supabase.rpc('is_superadmin');
      
      if (error) {
        console.error("Error checking superadmin role:", error);
        setIsSuperAdmin(false);
        setIsAdmin(false);
      } else {
        setIsSuperAdmin(data || false);
        // For backward compatibility, isAdmin = isSuperAdmin
        setIsAdmin(data || false);
      }
    } catch (error) {
      console.error("Error checking role:", error);
      setIsSuperAdmin(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isSuperAdmin, isAdmin, loading, refetch: checkRole };
};
