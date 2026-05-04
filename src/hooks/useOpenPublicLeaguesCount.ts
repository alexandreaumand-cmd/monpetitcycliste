import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOpenPublicLeaguesCount() {
  return useQuery({
    queryKey: ["open-public-leagues-count"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leagues")
        .select("id, current_player_count, max_players")
        .eq("visibility", "public")
        .eq("status", "pending");

      if (error) throw error;

      return (data ?? []).filter(
        (l) => (l.current_player_count ?? 0) < (l.max_players ?? 0),
      ).length;
    },
  });
}
