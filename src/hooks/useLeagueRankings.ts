import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { ensureLeagueId } from "@/lib/leagues/ensureLeagueId";

type RowSeason = { 
  league_id: string; 
  saison_id: string; 
  manager_id: string; 
  total_points: number;
  race_points?: number;
  bonus_points?: number;
  scoreurs_count?: number;
  victories_count?: number;
  manager_nom?: string;
};

type RowPhase = { 
  league_id: string; 
  phase_id: string; 
  manager_id: string; 
  total_points: number;
  manager_nom?: string;
};

export function useSeasonRankings(seasonId: string) {
  const { leagueId } = useLeague();
  const [data, setData] = useState<RowSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await ensureLeagueId(leagueId);
      const { data, error } = await supabase
        .from("v_manager_standings_by_season_v2")
        .select("*")
        .eq("league_id", id)
        .eq("saison_id", seasonId)
        .order("total_points", { ascending: false });
      
      if (error) throw error;
      setData(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [leagueId, seasonId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function usePhaseRankings(phaseId: string) {
  const { leagueId } = useLeague();
  const [data, setData] = useState<RowPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await ensureLeagueId(leagueId);
      const { data, error } = await supabase
        .from("v_manager_standings_by_phase_v2")
        .select("*")
        .eq("league_id", id)
        .eq("phase_id", phaseId)
        .order("total_points", { ascending: false });
      
      if (error) throw error;
      setData(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [leagueId, phaseId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
