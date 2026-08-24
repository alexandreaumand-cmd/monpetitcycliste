import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityKind =
  | "result"
  | "pronostic"
  | "pronostic_result"
  | "injury"
  | "startlist"
  | "chat"
  | "auction";

export interface ActivityItem {
  kind: ActivityKind;
  occurred_at: string;
  title: string;
  subtitle: string | null;
  course_id: string | null;
  etape_numero: number | null;
  my_points: number | null;
  my_rank: number | null;
  count_value: number | null;
  is_mine: boolean;
  link_path: string;
  /** Course name without the stage suffix — used to group rows per race. */
  course_nom: string | null;
  /** Riders involved (scoring riders for results, picked rider for pronostics). */
  riders: string | null;
  /** Startlist moves: owning league / manager. */
  league_name: string | null;
  manager_nom: string | null;
  manager_is_me: boolean | null;
}


/**
 * Unified league activity feed (results, pronostics, injuries, startlist moves,
 * trash talk, auctions) personalised for the given manager.
 */
export function useLeagueActivityFeed(
  leagueId: string | null | undefined,
  managerId: string | null | undefined,
  days = 21,
  limit = 40
) {
  return useQuery({
    queryKey: ["league-activity-feed", leagueId, managerId, days, limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_league_activity_feed", {
        p_league_id: leagueId,
        p_manager_id: managerId,
        p_days: days,
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => ({
        ...row,
        my_points: row.my_points === null ? null : Number(row.my_points),
      })) as ActivityItem[];
    },
    enabled: !!leagueId && !!managerId,
    staleTime: 60 * 1000,
  });
}

const LAST_SEEN_KEY = "labordure.activityFeed.lastSeen";

export function getActivityLastSeen(leagueId: string): number {
  try {
    const raw = window.localStorage.getItem(`${LAST_SEEN_KEY}.${leagueId}`);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function setActivityLastSeen(leagueId: string) {
  try {
    window.localStorage.setItem(`${LAST_SEEN_KEY}.${leagueId}`, String(Date.now()));
  } catch {
    // storage unavailable — badge simply won't persist
  }
}
