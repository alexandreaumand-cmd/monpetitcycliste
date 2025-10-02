import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Call the secure is_admin() function
      const { data, error } = await supabase.rpc('is_admin');
      
      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data || false);
      }
    } catch (error) {
      console.error("Error checking role:", error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading, refetch: checkRole };
};
