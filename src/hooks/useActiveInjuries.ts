import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveInjury = {
  id: string;
  coureur_id: string;
  injury: string;
  injury_context: string | null;
  injury_date: string;
  weeks_out: number;
  estimated_return_date: string;
};

export function useActiveInjuries() {
  return useQuery({
    queryKey: ["active-rider-injuries"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, ActiveInjury>> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("rider_injuries")
        .select(
          "id, coureur_id, injury, injury_context, injury_date, weeks_out, estimated_return_date",
        )
        .gte("estimated_return_date", today);
      if (error) throw error;
      const map = new Map<string, ActiveInjury>();
      for (const row of data ?? []) {
        const existing = map.get(row.coureur_id);
        if (!existing || row.injury_date > existing.injury_date) {
          map.set(row.coureur_id, row as ActiveInjury);
        }
      }
      return map;
    },
  });
}

export function useInjuryFor(coureurId: string | null | undefined): ActiveInjury | null {
  const { data } = useActiveInjuries();
  if (!coureurId || !data) return null;
  return data.get(coureurId) ?? null;
}
