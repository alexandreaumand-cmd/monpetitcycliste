import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Calendar, Lock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Phase = {
  id: string;
  index_dans_saison: number;
  date_debut: string;
  date_fin: string;
  statut: string;
  saison_id: string;
};

type Auction = {
  id: string;
  league_id: string;
  round_number: number;
  statut: string;
  opens_at: string | null;
  deadline_at: string | null;
  phase_id: string | null;
  leagues?: { name: string } | null;
};

export default function SuperAdminPhasesPage() {
  const queryClient = useQueryClient();

  const { data: saisons = [] } = useQuery({
    queryKey: ["admin-saisons-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [saisonId, setSaisonId] = useState<string | null>(null);
  const effectiveSaisonId = saisonId ?? saisons[0]?.id ?? null;

  const { data: phases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ["admin-phases-manage", effectiveSaisonId],
    queryFn: async (): Promise<Phase[]> => {
      if (!effectiveSaisonId) return [];
      const { data, error } = await supabase
        .from("phases")
        .select("id, index_dans_saison, date_debut, date_fin, statut, saison_id")
        .eq("saison_id", effectiveSaisonId)
        .order("index_dans_saison");
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveSaisonId,
  });

  const phaseIds = phases.map((p) => p.id);

  const { data: auctions = [] } = useQuery({
    queryKey: ["admin-phases-auctions", phaseIds.join(",")],
    queryFn: async (): Promise<Auction[]> => {
      if (phaseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("auctions")
        .select("id, league_id, round_number, statut, opens_at, deadline_at, phase_id, leagues(name)")
        .in("phase_id", phaseIds)
        .in("statut", ["open", "scheduled"])
        .order("opens_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: phaseIds.length > 0,
  });

  const today = new Date().toISOString().split("T")[0];
  const calendarActivePhase = useMemo(() => {
    if (phases.length === 0) return null;
    const current = phases.find((p) => p.date_debut <= today && today <= p.date_fin);
    if (current) return current;
    const next = phases.find((p) => p.date_debut > today);
    return next ?? phases[phases.length - 1];
  }, [phases, today]);

  const dbActivePhase = phases.find((p) => p.statut === "active") ?? null;
  const isDesynced =
    !!calendarActivePhase && !!dbActivePhase && calendarActivePhase.id !== dbActivePhase.id;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-phases-manage"] });
    queryClient.invalidateQueries({ queryKey: ["admin-phases-auctions"] });
    queryClient.invalidateQueries({ queryKey: ["phases"] });
    queryClient.invalidateQueries({ queryKey: ["admin-phases"] });
    queryClient.invalidateQueries({ queryKey: ["active-phase"] });
    queryClient.invalidateQueries({ queryKey: ["league-auction-status"] });
    queryClient.invalidateQueries({ queryKey: ["league-cards-data"] });
    queryClient.invalidateQueries({ queryKey: ["next-auction-info"] });
  };

  const setStatusMutation = useMutation({
    mutationFn: async ({ phaseId, statut }: { phaseId: string; statut: string }) => {
      const target = phases.find((p) => p.id === phaseId);
      if (!target) throw new Error("Phase introuvable");

      if (statut === "active") {
        // Cascade: earlier phases -> completed, later phases -> draft, this -> active
        const updates = phases.map((p) => {
          let newStatut: string;
          if (p.id === phaseId) newStatut = "active";
          else if (p.index_dans_saison < target.index_dans_saison) newStatut = "completed";
          else newStatut = "draft";
          return { id: p.id, statut: newStatut };
        });
        // Only update phases whose statut actually changes
        const toUpdate = updates.filter((u) => {
          const cur = phases.find((p) => p.id === u.id)!;
          return cur.statut !== u.statut;
        });
        for (const u of toUpdate) {
          const { error } = await supabase
            .from("phases")
            .update({ statut: u.statut })
            .eq("id", u.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("phases")
          .update({ statut })
          .eq("id", phaseId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const closeAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      const { error } = await supabase
        .from("auctions")
        .update({ statut: "closed", closed_at: new Date().toISOString() })
        .eq("id", auctionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Enchère fermée");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const statutBadge = (statut: string) => {
    switch (statut) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "completed":
        return <Badge variant="secondary">Terminée</Badge>;
      case "draft":
        return <Badge variant="outline">Brouillon</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Gestion des phases
          </h1>
          <p className="text-sm text-muted-foreground">
            Bascule manuelle du statut « en cours » et fermeture des enchères résiduelles.
          </p>
        </div>
        <div className="w-56">
          <Select value={effectiveSaisonId ?? ""} onValueChange={(v) => setSaisonId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Saison" />
            </SelectTrigger>
            <SelectContent>
              {saisons.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  Saison {s.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isDesynced && dbActivePhase && calendarActivePhase && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Désynchronisation détectée</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>
              Statut en base : <strong>Phase {dbActivePhase.index_dans_saison}</strong>. Selon le
              calendrier, la phase active devrait être{" "}
              <strong>Phase {calendarActivePhase.index_dans_saison}</strong>.
            </span>
            <Button
              size="sm"
              onClick={() =>
                setStatusMutation.mutate({ phaseId: calendarActivePhase.id, statut: "active" })
              }
              disabled={setStatusMutation.isPending}
            >
              Synchroniser sur Phase {calendarActivePhase.index_dans_saison}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Phases de la saison</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPhases ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="space-y-2">
              {phases.map((p) => {
                const isCalendarActive = calendarActivePhase?.id === p.id;
                const relatedAuctions = auctions.filter((a) => a.phase_id === p.id);
                return (
                  <div
                    key={p.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-semibold min-w-24">Phase {p.index_dans_saison}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(p.date_debut), "dd MMM", { locale: fr })}
                        {" → "}
                        {format(new Date(p.date_fin), "dd MMM yyyy", { locale: fr })}
                      </div>
                      {statutBadge(p.statut)}
                      {isCalendarActive && (
                        <Badge variant="outline" className="border-primary text-primary">
                          Calendrier : en cours
                        </Badge>
                      )}
                      <div className="flex-1" />
                      <div className="flex gap-2">
                        {p.statut !== "active" && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={setStatusMutation.isPending}
                            onClick={() =>
                              setStatusMutation.mutate({ phaseId: p.id, statut: "active" })
                            }
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Marquer active
                          </Button>
                        )}
                        {p.statut !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={setStatusMutation.isPending}
                            onClick={() =>
                              setStatusMutation.mutate({ phaseId: p.id, statut: "completed" })
                            }
                          >
                            <Lock className="h-4 w-4 mr-1" /> Terminée
                          </Button>
                        )}
                        {p.statut !== "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={setStatusMutation.isPending}
                            onClick={() =>
                              setStatusMutation.mutate({ phaseId: p.id, statut: "draft" })
                            }
                          >
                            Brouillon
                          </Button>
                        )}
                      </div>
                    </div>

                    {relatedAuctions.length > 0 && (
                      <div className="pl-4 border-l-2 border-muted space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Enchères non fermées ({relatedAuctions.length})
                        </div>
                        {relatedAuctions.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 text-sm flex-wrap py-1"
                          >
                            <span className="font-medium">
                              {a.leagues?.name ?? a.league_id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Round {a.round_number}
                            </Badge>
                            <Badge
                              variant={a.statut === "open" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {a.statut}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {a.opens_at
                                ? `ouvre ${format(new Date(a.opens_at), "dd/MM HH:mm", { locale: fr })}`
                                : "sans date"}
                            </span>
                            <div className="flex-1" />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={closeAuctionMutation.isPending}
                              onClick={() => closeAuctionMutation.mutate(a.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Fermer
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {phases.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune phase pour cette saison.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
