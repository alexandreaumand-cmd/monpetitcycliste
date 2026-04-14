import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Lock, Megaphone, Clock, Users, AlertTriangle, Trophy, Bike } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const GAME_MODE_LABELS: Record<string, string> = {
  five_phases: "5 Phases",
  per_course: "À la course",
  full_season: "Saison complète",
  short_gt: "GT Court",
  short_wt: "WT Court",
  short_classics: "Classiques",
};

interface AuctionWithLeague {
  id: string;
  league_id: string;
  league_name: string;
  owner_name?: string;
  owner_email?: string;
  round_number: number;
  statut: string;
  deadline_at: string;
  closed_at: string | null;
  phase_id: string;
  created_at: string | null;
  game_mode?: string;
  budget?: number;
  max_riders?: number;
  courses?: string[];
  validation?: {
    validated_count: number;
    total_managers: number;
    managers: { manager_id: string; manager_name: string; has_validated: boolean }[];
  };
  unpublished_annonces_count?: number;
}

export const SuperAdminAuctionsMonitor = () => {
  const [auctions, setAuctions] = useState<AuctionWithLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const fetchAuctions = useCallback(async () => {
    try {
      // Fetch open and closed auctions
      const { data: auctionRows, error: auctionsErr } = await supabase
        .from("auctions")
        .select("*")
        .in("statut", ["open", "closed"])
        .order("created_at", { ascending: false });

      if (auctionsErr) throw auctionsErr;
      if (!auctionRows || auctionRows.length === 0) {
        setAuctions([]);
        return;
      }

      // Fetch league info via edge function (bypasses RLS)
      const leagueIds = [...new Set(auctionRows.map((a) => a.league_id))];
      const { data: leaguesData } = await supabase.functions.invoke("admin-get-leagues-info", {
        body: { league_ids: leagueIds },
      });

      const leagueMap = new Map<string, { name: string; game_mode?: string; settings?: Record<string, any>; owner_name?: string; owner_email?: string }>();
      if (leaguesData && !leaguesData.error) {
        for (const [id, info] of Object.entries(leaguesData as Record<string, any>)) {
          leagueMap.set(id, {
            name: info.name,
            game_mode: info.game_mode,
            settings: info.settings,
            owner_name: info.owner_name,
            owner_email: info.owner_email,
          });
        }
      }

      // Fetch league scopes for selected_course_ids
      const { data: scopes } = await supabase
        .from("league_scopes")
        .select("league_id, selected_course_ids")
        .in("league_id", leagueIds);

      const scopeMap = new Map<string, string[]>();
      if (scopes) {
        for (const s of scopes) {
          if (s.selected_course_ids && s.selected_course_ids.length > 0) {
            scopeMap.set(s.league_id, s.selected_course_ids);
          }
        }
      }

      // Fetch course names for all selected_course_ids
      const allCourseIds = [...new Set([...scopeMap.values()].flat())];
      let courseNameMap = new Map<string, string>();
      if (allCourseIds.length > 0) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, nom")
          .in("id", allCourseIds);
        if (courses) {
          for (const c of courses) {
            courseNameMap.set(c.id, c.nom);
          }
        }
      }

      // Fetch unpublished annonces counts for closed auctions
      const closedIds = auctionRows.filter((a) => a.statut === "closed").map((a) => a.id);
      let annoncesCounts = new Map<string, number>();
      if (closedIds.length > 0) {
        const { data: annonces } = await supabase
          .from("annonces")
          .select("auction_id")
          .in("auction_id", closedIds)
          .eq("published", false);

        if (annonces) {
          for (const a of annonces) {
            annoncesCounts.set(a.auction_id, (annoncesCounts.get(a.auction_id) || 0) + 1);
          }
        }
      }

      // Build auction list
      const enriched: AuctionWithLeague[] = auctionRows.map((a) => {
        const league = leagueMap.get(a.league_id);
        const settings = league?.settings || {};
        const courseIds = scopeMap.get(a.league_id) || [];
        return {
          id: a.id,
          league_id: a.league_id,
          league_name: league?.name || "Ligue inconnue",
          owner_name: league?.owner_name,
          owner_email: league?.owner_email,
          round_number: a.round_number,
          statut: a.statut || "open",
          deadline_at: a.deadline_at,
          closed_at: a.closed_at,
          phase_id: a.phase_id,
          created_at: a.created_at,
          game_mode: league?.game_mode,
          budget: settings.budget,
          max_riders: settings.max_riders,
          courses: courseIds.map((id) => courseNameMap.get(id) || id),
          unpublished_annonces_count: annoncesCounts.get(a.id) || 0,
        };
      });

      // Fetch validation status for open auctions
      const openAuctions = enriched.filter((a) => a.statut === "open");
      await Promise.all(
        openAuctions.map(async (auction) => {
          try {
            const { data } = await supabase.functions.invoke("auction-get-validation-status", {
              body: { auction_id: auction.id, league_id: auction.league_id },
            });
            if (data && !data.error) {
              auction.validation = {
                validated_count: data.validated_count || 0,
                total_managers: data.total_managers || 0,
                managers: data.managers || [],
              };
            }
          } catch {
            // Ignore validation fetch errors
          }
        })
      );

      setAuctions(enriched);
    } catch (err) {
      console.error("Error fetching auctions:", err);
      toast.error("Erreur lors du chargement des enchères");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 10000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  const handleCloseRound = async (auction: AuctionWithLeague) => {
    setClosingId(auction.id);
    try {
      const { data, error } = await supabase.functions.invoke("clore-round", {
        body: { auction_id: auction.id, league_id: auction.league_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Round ${auction.round_number} clôturé pour ${auction.league_name}`);
      await fetchAuctions();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la clôture");
    } finally {
      setClosingId(null);
    }
  };

  const handlePublishAnnonces = async (auction: AuctionWithLeague) => {
    setPublishingId(auction.id);
    try {
      const { data, error } = await supabase.functions.invoke("publier-annonce", {
        body: { auction_id: auction.id, publish_all: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Annonces publiées pour ${auction.league_name} - Round ${auction.round_number}`);
      await fetchAuctions();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la publication");
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openAuctions = auctions.filter((a) => a.statut === "open");
  const closedAuctions = auctions.filter((a) => a.statut === "closed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Suivi des Enchères</h2>
          <p className="text-sm text-muted-foreground">
            Moniteur temps réel de toutes les enchères actives
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAuctions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Rafraîchir
        </Button>
      </div>

      {auctions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune enchère active ou en attente de publication.
          </CardContent>
        </Card>
      )}

      {/* Open auctions */}
      {openAuctions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Enchères ouvertes ({openAuctions.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {openAuctions.map((auction) => (
              <Card key={auction.id} className="border-amber-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{auction.league_name}</CardTitle>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                      Round {auction.round_number}
                    </Badge>
                  </div>
                  {auction.owner_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Créateur : {auction.owner_name}{auction.owner_email ? ` (${auction.owner_email})` : ''}
                    </p>
                  )}
                  {/* League details */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {auction.game_mode && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        <Trophy className="h-3 w-3 mr-1" />
                        {GAME_MODE_LABELS[auction.game_mode] || auction.game_mode}
                      </Badge>
                    )}
                    {auction.budget && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {auction.budget}M€
                      </Badge>
                    )}
                    {auction.max_riders && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        <Bike className="h-3 w-3 mr-1" />
                        {auction.max_riders}
                      </Badge>
                    )}
                  </div>
                  {auction.courses && auction.courses.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {auction.courses.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] h-5 font-normal">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Deadline : {format(new Date(auction.deadline_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </div>
                  </div>

                  {/* Validation progress */}
                  {auction.validation && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Validations
                        </span>
                        <span className="font-medium">
                          {auction.validation.validated_count} / {auction.validation.total_managers}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{
                            width: `${auction.validation.total_managers > 0 ? (auction.validation.validated_count / auction.validation.total_managers) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      {/* Manager list */}
                      <div className="space-y-1">
                        {auction.validation.managers.map((m) => (
                          <div key={m.manager_id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{m.manager_name}</span>
                            <Badge variant={m.has_validated ? "default" : "outline"} className="text-[10px] h-5">
                              {m.has_validated ? "✅ Validé" : "⏳ En attente"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={closingId === auction.id}
                    onClick={() => handleCloseRound(auction)}
                  >
                    {closingId === auction.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    Clôturer le Round
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Closed auctions with unpublished annonces */}
      {closedAuctions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Rounds clôturés — annonces en attente ({closedAuctions.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {closedAuctions.map((auction) => (
              <Card key={auction.id} className="border-orange-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{auction.league_name}</CardTitle>
                    <Badge variant="outline" className="text-orange-600 border-orange-500/50">
                      Round {auction.round_number}
                    </Badge>
                  </div>
                  {auction.owner_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Créateur : {auction.owner_name}{auction.owner_email ? ` (${auction.owner_email})` : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {auction.game_mode && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        <Trophy className="h-3 w-3 mr-1" />
                        {GAME_MODE_LABELS[auction.game_mode] || auction.game_mode}
                      </Badge>
                    )}
                    {auction.budget && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {auction.budget}M€
                      </Badge>
                    )}
                    {auction.max_riders && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        <Bike className="h-3 w-3 mr-1" />
                        {auction.max_riders}
                      </Badge>
                    )}
                  </div>
                  {auction.courses && auction.courses.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {auction.courses.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] h-5 font-normal">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {auction.closed_at && (
                      <div>Clôturé le {format(new Date(auction.closed_at), "dd MMM yyyy HH:mm", { locale: fr })}</div>
                    )}
                    <div>{auction.unpublished_annonces_count} annonce(s) non publiée(s)</div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    disabled={publishingId === auction.id || auction.unpublished_annonces_count === 0}
                    onClick={() => handlePublishAnnonces(auction)}
                  >
                    {publishingId === auction.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Megaphone className="h-4 w-4 mr-2" />
                    )}
                    Publier les annonces
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
