import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, DollarSign, TrendingUp, Award } from "lucide-react";
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
        .select("coureur_id, coureurs!inner(id, nom), equipe, prix_initial")
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
            cote_initiale: c.prix_initial || 0,
          },
        ])
      );

      return rosterData.map((r) => ({
        coureur_id: r.coureur_id,
        nom: coureursMap.get(r.coureur_id)?.nom || "",
        equipe: coureursMap.get(r.coureur_id)?.equipe || "",
        prix_signature: r.prix_signature,
        cote_initiale: coureursMap.get(r.coureur_id)?.cote_initiale || 0,
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
  const spentPercentage = (totalSpent / budget) * 100;
  const rosterCompletion = (roster.length / maxRiders) * 100;

  // Calculs des nouveaux KPIs
  const totalCotes = roster.reduce((sum, r) => sum + Number(r.cote_initiale), 0);

  const mostExpensive = roster.length > 0 ? roster.reduce((max, r) => 
    Number(r.prix_signature) > Number(max.prix_signature) ? r : max
  , roster[0]) : { prix_signature: 0, nom: "-" };

  const mostOverpaid = roster.length > 0 ? roster.reduce((max, r) => {
    const diff = Number(r.prix_signature) - Number(r.cote_initiale);
    const maxDiff = Number(max.prix_signature) - Number(max.cote_initiale);
    return diff > maxDiff ? r : max;
  }, roster[0]) : { prix_signature: 0, cote_initiale: 0, nom: "-" };

  const highestCote = roster.length > 0 ? roster.reduce((max, r) => 
    Number(r.cote_initiale) > Number(max.cote_initiale) ? r : max
  , roster[0]) : { cote_initiale: 0, nom: "-" };

  // Sort by price descending for podium effect
  const sortedByPrice = [...roster].sort((a, b) => Number(b.prix_signature) - Number(a.prix_signature));
  
  // Sort by round then by amount for display
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
      {/* Hero Budget Card */}
      <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/30">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <CardTitle className="text-3xl flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Mon Équipe Finale
              </CardTitle>
              <p className="text-muted-foreground">Composition complète de votre effectif</p>
            </div>
            <div className="flex gap-3 items-center">
              <Badge variant="default" className="text-lg px-5 py-2 bg-primary">
                {roster.length} / {maxRiders}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nouveaux KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Valeur théorique */}
            <div className="p-4 bg-background/80 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-muted-foreground">Valeur théorique</p>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatAmount(totalCotes)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Somme des cotes initiales
              </p>
            </div>

            {/* Coureur le plus cher */}
            <div className="p-4 bg-background/80 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-muted-foreground">Coureur le plus cher</p>
              </div>
              <p className="text-lg font-bold truncate">{mostExpensive.nom}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatAmount(mostExpensive.prix_signature)}
              </p>
            </div>

            {/* Coureur le plus surpayé */}
            <div className="p-4 bg-background/80 rounded-xl border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm text-muted-foreground">Le plus surpayé</p>
              </div>
              <p className="text-lg font-bold truncate">{mostOverpaid.nom}</p>
              <p className="text-xs text-muted-foreground mt-1">
                +{formatAmount(Number(mostOverpaid.prix_signature) - Number(mostOverpaid.cote_initiale))} vs cote
              </p>
            </div>

            {/* Cote la plus haute */}
            <div className="p-4 bg-background/80 rounded-xl border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm text-muted-foreground">Cote la plus haute</p>
              </div>
              <p className="text-lg font-bold truncate">{highestCote.nom}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cote: {formatAmount(highestCote.cote_initiale)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster by Round */}
      <div className="space-y-4">
        {Object.entries(rosterByRound)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([roundNum, riders], roundIdx) => (
            <Card key={roundNum} className="animate-fade-in hover-scale" style={{ animationDelay: `${roundIdx * 50}ms` }}>
              <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-background">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <Badge variant="secondary" className="text-base px-4 py-1.5 bg-primary/20 border-primary/30">
                      Round {roundNum}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {riders.length} coureur{riders.length > 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                  <Badge variant="outline" className="text-sm">
                    {formatAmount(riders.reduce((sum, r) => sum + Number(r.prix_signature), 0))} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {riders.map((rider, idx) => {
                    const isPodium = sortedByPrice.slice(0, 3).find(r => r.coureur_id === rider.coureur_id);
                    const podiumPosition = isPodium ? sortedByPrice.indexOf(rider) + 1 : null;
                    
                    return (
                      <Card
                        key={rider.coureur_id}
                        className={`transition-all hover:shadow-lg hover:scale-[1.02] ${
                          podiumPosition === 1 ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-background' :
                          podiumPosition === 2 ? 'border-gray-400/50 bg-gradient-to-br from-gray-400/10 to-background' :
                          podiumPosition === 3 ? 'border-orange-600/50 bg-gradient-to-br from-orange-600/10 to-background' :
                          ''
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold text-base truncate">{rider.nom}</p>
                                {podiumPosition && (
                                  <Badge variant="outline" className="text-xs">
                                    {podiumPosition === 1 ? '🥇' : podiumPosition === 2 ? '🥈' : '🥉'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{rider.equipe}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-primary">
                                {formatAmount(rider.prix_signature)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
