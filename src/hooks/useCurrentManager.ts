import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Cached hook for current manager - avoids redundant auth calls
export function useCurrentManager() {
  return useQuery({
    queryKey: ["current-manager"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data: manager } = await supabase
        .from("managers")
        .select("id, nom, user_id, avatar_url, sponsor, email")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      return manager;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}
