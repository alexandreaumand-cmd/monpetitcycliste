import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatAmount } from "@/lib/utils";

interface FinalTeamTabProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  budget: number;
  maxRiders: number;
}

export function FinalTeamTab({
  phaseId,
  managerId,
  leagueId,
  budget,
  maxRiders,
}: FinalTeamTabProps) {
  // Fetch roster with round acquisition data
  const { data: roster = [], isLoading } = useQuery({
    queryKey: ["final-team", phaseId, managerId, leagueId],
    queryFn: async () => {
      let rosterQuery = supabase
        .from("rosters")
        .select(`
          coureur_id,
          prix_signature
        `)
        .eq("manager_id", managerId)
        .eq("phase_id", phaseId);

      if (leagueId) {
        rosterQuery = rosterQuery.or(`league_id.eq.${leagueId},league_id.is.null`);
      }

      const { data: rosterData, error: rosterError } = await rosterQuery;
      if (rosterError) throw rosterError;

      if (!rosterData || rosterData.length === 0) return [];

      // Get round numbers from annonces
      const { data: annonces } = await supabase
        .from("annonces")
        .select("coureur_id, round_number, winning_amount")
        .eq("winning_manager_id", managerId)
        .in(
          "coureur_id",
          rosterData.map((r) => r.coureur_id)
        );

      const roundMap = new Map(
        (annonces || []).map((a) => [a.coureur_id, a.round_number])
      );

      // Get rider details
      const { data: phase } = await supabase
        .from("phases")
        .select("saison_id")
        .eq("id", phaseId)
        .single();

      if (!phase) return [];

      const { data: coureurs } = await supabase
        .from("coureurs_saisons")
        .select("coureur_id, coureurs!inner(id, nom), equipe")
        .eq("saison_id", phase.saison_id)
        .in(
          "coureur_id",
          rosterData.map((r) => r.coureur_id)
        );

      const coureursMap = new Map(
        (coureurs || []).map((c: any) => [
          c.coureur_id,
          {
            nom: c.coureurs?.nom || "",
            equipe: c.equipe || "",
          },
        ])
      );

      return rosterData.map((r) => ({
        coureur_id: r.coureur_id,
        nom: coureursMap.get(r.coureur_id)?.nom || "",
        equipe: coureursMap.get(r.coureur_id)?.equipe || "",
        prix_signature: r.prix_signature,
        round_number: roundMap.get(r.coureur_id) || null,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalSpent = roster.reduce((sum, r) => sum + Number(r.prix_signature), 0);
  const remaining = budget - totalSpent;

  // Sort by round then by amount
  const sortedRoster = [...roster].sort((a, b) => {
    if (a.round_number !== b.round_number) {
      return (a.round_number || 0) - (b.round_number || 0);
    }
    return Number(b.prix_signature) - Number(a.prix_signature);
  });

  // Group by round
  const rosterByRound = sortedRoster.reduce((acc, rider) => {
    const round = rider.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(rider);
    return acc;
  }, {} as Record<number, typeof roster>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-2xl">👥 Mon Équipe Finale</CardTitle>
            <div className="flex gap-3">
              <Badge variant="default" className="text-lg px-4 py-2">
                {roster.length} / {maxRiders} coureurs
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Budget Initial</p>
              <p className="text-xl font-bold">{formatAmount(budget)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget Dépensé</p>
              <p className="text-xl font-bold text-primary">{formatAmount(totalSpent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget Restant</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatAmount(remaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster by Round */}
      <div className="space-y-4">
        {Object.entries(rosterByRound)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([roundNum, riders]) => (
            <Card key={roundNum}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline">Round {roundNum}</Badge>
                  <span className="text-sm font-normal text-muted-foreground">
                    {riders.length} coureur{riders.length > 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {riders.map((rider) => (
                    <div
                      key={rider.coureur_id}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{rider.nom}</p>
                        <p className="text-sm text-muted-foreground">{rider.equipe}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {formatAmount(rider.prix_signature)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
