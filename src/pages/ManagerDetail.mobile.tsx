import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { ArrowLeft, Trophy, TrendingUp, Users, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerBreakdown } from "@/components/rankings/ManagerBreakdown";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { ManagerPrestigeIcons } from "@/components/rankings/ManagerPrestigeIcons";

export const ManagerDetailMobile = () => {
  const { managerId } = useParams<{ managerId: string }>();
  const navigate = useNavigate();
  const { selectedSeason, activePhase } = useSeasonContext();
  const { leagueId } = useLeague();

  const { data: standing, isLoading } = useQuery({
    queryKey: ["manager-detail", managerId, selectedSeason?.id, leagueId],
    queryFn: async () => {
      if (!managerId || !leagueId) return null;

      const { data, error } = await supabase
        .from("v_manager_standings_by_season_v2")
        .select("*")
        .eq("manager_id", managerId)
        .eq("saison_id", selectedSeason?.id)
        .eq("league_id", leagueId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!managerId && !!selectedSeason?.id && !!leagueId,
  });

  const { data: allStandings } = useQuery({
    queryKey: ["all-standings", selectedSeason?.id, leagueId],
    queryFn: async () => {
      if (!leagueId || !selectedSeason?.id) return [];

      const { data, error } = await supabase
        .from("v_manager_standings_by_season_v2")
        .select("*")
        .eq("saison_id", selectedSeason.id)
        .eq("league_id", leagueId)
        .order("total_points", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSeason?.id && !!leagueId,
  });

  const { data: sponsorData } = useManagerSponsor(managerId || "", selectedSeason?.id);

  const rank = allStandings?.findIndex(s => s.manager_id === managerId) + 1 || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!standing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Manager introuvable</h1>
          </div>
        </div>
      </div>
    );
  }

  const getRankLabel = (r: number) => {
    if (r === 1) return "1er";
    if (r === 2) return "2e";
    if (r === 3) return "3e";
    return `${r}e`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{standing.manager_nom}</h1>
            {sponsorData?.sponsor && (
              <p className="text-xs text-muted-foreground italic">
                {sponsorData.sponsor}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Card */}
        <div className="bg-card rounded-2xl border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Classement</p>
                <p className="text-2xl font-bold">{getRankLabel(rank)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Points</p>
              <p className="text-2xl font-bold">{standing.total_points}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ManagerPrestigeIcons
              managerId={managerId || ""}
              saisonId={selectedSeason?.id}
              isMobile
            />
            {rank === 10 && <span className="text-lg">🤡</span>}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Scoreurs</p>
              <p className="text-lg font-semibold">{standing.scoreurs_count ?? 0}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Victoires</p>
              <p className="text-lg font-semibold">{standing.victories_count ?? 0}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Points courses</p>
              <p className="text-lg font-semibold">{standing.race_points ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <ManagerBreakdown managerId={managerId || ""} />
      </div>
    </div>
  );
};
