import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Loader2, Plus, RefreshCw, RotateCcw, X } from "lucide-react";

const CATEGORIES = ["WT", "PRO CONTI", "CT", "PT", "OT", "CLUB", "OUT", "SUS"];

type Transfer = {
  id: string;
  published_at: string | null;
  pcs_rider_name: string;
  from_team_name: string | null;
  to_team_name: string;
  target_year: number;
  saison_id: string | null;
  coureur_id: string | null;
  equipe_id: string | null;
  statut: string;
  notes: string | null;
};

type RiderSeason = { annee: number; actif: boolean; equipe: string | null };
type RiderOption = { id: string; nom: string; seasons: RiderSeason[] };



export const TransfersManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState<string>("nouveau");
  const [year, setYear] = useState<string>("all");
  const [scraping, setScraping] = useState(false);
  const [riderSearch, setRiderSearch] = useState<Record<string, string>>({});
  const [createTeamFor, setCreateTeamFor] = useState<Transfer | null>(null);
  const [teamForm, setTeamForm] = useState({ nom: "", trigramme: "", categorie: "CT" });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["rider-transfers", statut, year],
    queryFn: async () => {
      let q = supabase
        .from("rider_transfers")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(500);
      if (statut !== "all") q = q.eq("statut", statut);
      if (year !== "all") q = q.eq("target_year", parseInt(year, 10));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Transfer[];
    },
  });

  const { data: newCount } = useQuery({
    queryKey: ["rider-transfers", "new-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rider_transfers")
        .select("id", { count: "exact", head: true })
        .eq("statut", "nouveau");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: saisons } = useQuery({
    queryKey: ["saisons", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data as { id: string; annee: number }[];
    },
  });

  const seasonIds = useMemo(
    () => new Set((transfers ?? []).map((t) => t.saison_id).filter(Boolean) as string[]),
    [transfers],
  );

  const { data: teams } = useQuery({
    queryKey: ["equipes-saisons", "transfers", [...seasonIds].sort().join(",")],
    enabled: seasonIds.size > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipes_saisons")
        .select("equipe_id, saison_id, nom_affiche")
        .in("saison_id", [...seasonIds])
        .order("nom_affiche");
      if (error) throw error;
      return data as { equipe_id: string; saison_id: string; nom_affiche: string }[];
    },
  });

  // Enriched rider search: same names can exist on several fiches (legacy slug ids
  // vs short codes), so we surface id / last season / team to tell them apart.
  const riderQueries = useQuery({
    queryKey: ["coureurs", "transfer-search-v2", riderSearch],
    enabled: Object.values(riderSearch).some((v) => (v ?? "").length >= 2),
    queryFn: async () => {
      const terms = [...new Set(Object.values(riderSearch).filter((v) => (v ?? "").length >= 2))];
      const result: Record<string, RiderOption[]> = {};

      for (const term of terms) {
        const { data: base } = await supabase
          .from("coureurs")
          .select("id, nom")
          .ilike("nom", `%${term}%`)
          .limit(10);

        const ids = (base ?? []).map((r: any) => r.id);
        if (ids.length === 0) {
          result[term] = [];
          continue;
        }

        const { data: cs } = await supabase
          .from("coureurs_saisons")
          .select("coureur_id, saison_id, equipe_id, actif, saisons(annee)")
          .in("coureur_id", ids);

        const equipeIds = [
          ...new Set((cs ?? []).map((r: any) => r.equipe_id).filter(Boolean)),
        ] as string[];

        const teamMap = new Map<string, string>();
        if (equipeIds.length > 0) {
          const { data: eq } = await supabase
            .from("equipes_saisons")
            .select("equipe_id, saison_id, nom_affiche")
            .in("equipe_id", equipeIds);
          (eq ?? []).forEach((e: any) =>
            teamMap.set(`${e.equipe_id}|${e.saison_id}`, e.nom_affiche),
          );
        }

        const bySeasons = new Map<string, RiderSeason[]>();
        (cs ?? []).forEach((row: any) => {
          const annee = Array.isArray(row.saisons)
            ? row.saisons[0]?.annee
            : row.saisons?.annee;
          const list = bySeasons.get(row.coureur_id) ?? [];
          list.push({
            annee: annee ?? 0,
            actif: !!row.actif,
            equipe: row.equipe_id ? teamMap.get(`${row.equipe_id}|${row.saison_id}`) ?? null : null,
          });
          bySeasons.set(row.coureur_id, list);
        });

        result[term] = (base ?? [])
          .map((r: any) => ({
            id: r.id,
            nom: r.nom,
            seasons: (bySeasons.get(r.id) ?? []).sort((a, b) => b.annee - a.annee),
          }))
          .sort((a, b) => (b.seasons[0]?.annee ?? 0) - (a.seasons[0]?.annee ?? 0));
      }
      return result;
    },
  });

  // Names of already-matched riders (avoid showing raw ids)
  const matchedIds = useMemo(
    () => [...new Set((transfers ?? []).map((t) => t.coureur_id).filter(Boolean) as string[])],
    [transfers],
  );

  const { data: matchedNames } = useQuery({
    queryKey: ["coureurs", "transfer-matched", matchedIds.sort().join(",")],
    enabled: matchedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("coureurs").select("id, nom").in("id", matchedIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => (map[r.id] = r.nom));
      return map;
    },
  });


  const runScrape = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-pcs-transfers", {
        body: { days: 120 },
      });
      if (error) throw error;
      toast({
        title: "Scraping terminé",
        description: `${data?.inserted ?? 0} nouveau(x) transfert(s) sur ${data?.scraped ?? 0} lignes lues.`,
      });
      queryClient.invalidateQueries({ queryKey: ["rider-transfers"] });
    } catch (e) {
      toast({
        title: "Erreur de scraping",
        description: e instanceof Error ? e.message : "Échec",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await supabase.from("rider_transfers").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rider-transfers"] }),
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const applyTransfer = useMutation({
    mutationFn: async (t: Transfer) => {
      if (!t.saison_id) throw new Error(`Aucune saison ${t.target_year} en base : créez-la d'abord.`);
      if (!t.coureur_id) throw new Error("Sélectionnez d'abord le coureur");
      if (!t.equipe_id) throw new Error("Sélectionnez ou créez d'abord l'équipe d'arrivée");

      const { data: existing } = await supabase
        .from("coureurs_saisons")
        .select("id, prix_initial")
        .eq("saison_id", t.saison_id)
        .eq("coureur_id", t.coureur_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("coureurs_saisons")
          .update({ equipe_id: t.equipe_id, actif: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: rider } = await supabase
          .from("coureurs")
          .select("prix_initial")
          .eq("id", t.coureur_id)
          .maybeSingle();
        const { error } = await supabase.from("coureurs_saisons").insert({
          coureur_id: t.coureur_id,
          saison_id: t.saison_id,
          equipe_id: t.equipe_id,
          prix_initial: Number(rider?.prix_initial ?? 0),
          actif: true,
        });
        if (error) throw error;
      }

      // Keep the PCS spelling as an alias so future scrapes match automatically
      await supabase
        .from("name_aliases")
        .insert({ alias_text: t.pcs_rider_name, coureur_id: t.coureur_id })
        .then(() => undefined, () => undefined);

      const { error: upErr } = await supabase
        .from("rider_transfers")
        .update({ statut: "applique", applied_at: new Date().toISOString() })
        .eq("id", t.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast({ title: "Transfert appliqué" });
      queryClient.invalidateQueries({ queryKey: ["rider-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["coureurs-saisons"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const createTeam = useMutation({
    mutationFn: async () => {
      const t = createTeamFor!;
      if (!t.saison_id) throw new Error(`Aucune saison ${t.target_year} en base : créez-la d'abord.`);
      if (!teamForm.nom.trim()) throw new Error("Le nom de l'équipe est obligatoire");
      const code = (teamForm.trigramme || teamForm.nom.slice(0, 3)).toUpperCase();

      const { data: equipe, error } = await supabase
        .from("equipes")
        .insert({ code_court: code, nom_complet: teamForm.nom.trim() })
        .select("id")
        .single();
      if (error) throw error;

      const { error: esErr } = await supabase.from("equipes_saisons").insert({
        equipe_id: equipe.id,
        saison_id: t.saison_id,
        nom_affiche: teamForm.nom.trim(),
        categorie: teamForm.categorie,
        trigramme: code,
        actif: true,
      });
      if (esErr) throw esErr;

      const { error: tErr } = await supabase
        .from("rider_transfers")
        .update({ equipe_id: equipe.id })
        .eq("id", t.id);
      if (tErr) throw tErr;
    },
    onSuccess: () => {
      toast({ title: "Équipe créée" });
      setCreateTeamFor(null);
      queryClient.invalidateQueries({ queryKey: ["rider-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["equipes-saisons"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const years = useMemo(
    () => [...new Set((saisons ?? []).map((s) => s.annee).concat(new Date().getFullYear() + 1))]
      .sort((a, b) => b - a),
    [saisons],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                Transferts ProCyclingStats
                {(newCount ?? 0) > 0 && <Badge>{newCount} à traiter</Badge>}
              </CardTitle>
              <CardDescription>
                Récupérés automatiquement une fois par jour. Chaque transfert doit être validé
                manuellement.
              </CardDescription>
            </div>
            <Button onClick={runScrape} disabled={scraping} variant="outline">
              {scraping ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Scraper maintenant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nouveau">À traiter</SelectItem>
                  <SelectItem value="applique">Appliqués</SelectItem>
                  <SelectItem value="ignore">Ignorés</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Saison cible</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (transfers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun transfert.</p>
          ) : (
            <div className="space-y-3">
              {(transfers ?? []).map((t) => {
                const seasonTeams = (teams ?? []).filter((x) => x.saison_id === t.saison_id);
                const search = riderSearch[t.id] ?? "";
                const results = (riderQueries.data ?? {})[search] ?? [];
                return (
                  <div key={t.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{t.published_at ?? "—"}</span>
                      <span className="font-semibold">{t.pcs_rider_name}</span>
                      <Badge variant="outline">{t.target_year}</Badge>
                      <span className="text-muted-foreground flex items-center gap-1">
                        {t.from_team_name || "Sans équipe"}
                        <ArrowRight className="h-3 w-3" />
                        {t.to_team_name}
                      </span>
                      {t.statut !== "nouveau" && (
                        <Badge variant={t.statut === "applique" ? "default" : "secondary"}>
                          {t.statut === "applique" ? "Appliqué" : "Ignoré"}
                        </Badge>
                      )}
                    </div>

                    {!t.saison_id && (
                      <p className="text-sm text-destructive">
                        Saison {t.target_year} inexistante en base — créez-la puis relancez le
                        scraping.
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Coureur</Label>
                        {t.coureur_id ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{t.coureur_id}</Badge>
                            {t.statut === "nouveau" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => patch.mutate({ id: t.id, values: { coureur_id: null } })}
                              >
                                Changer
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              placeholder="Rechercher un coureur…"
                              value={search}
                              onChange={(e) =>
                                setRiderSearch((s) => ({ ...s, [t.id]: e.target.value }))
                              }
                            />
                            {results.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {results.map((r) => (
                                  <Button
                                    key={r.id}
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      patch.mutate({ id: t.id, values: { coureur_id: r.id } })
                                    }
                                  >
                                    {r.nom}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Équipe d'arrivée ({t.target_year})</Label>
                        <div className="flex gap-2">
                          <Select
                            value={t.equipe_id ?? ""}
                            onValueChange={(v) => patch.mutate({ id: t.id, values: { equipe_id: v } })}
                            disabled={!t.saison_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir une équipe" />
                            </SelectTrigger>
                            <SelectContent>
                              {seasonTeams.map((team) => (
                                <SelectItem key={team.equipe_id} value={team.equipe_id}>
                                  {team.nom_affiche}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="icon"
                            title="Créer l'équipe"
                            disabled={!t.saison_id}
                            onClick={() => {
                              setCreateTeamFor(t);
                              setTeamForm({
                                nom: t.to_team_name,
                                trigramme: t.to_team_name.slice(0, 3).toUpperCase(),
                                categorie: "CT",
                              });
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {t.statut === "nouveau" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => applyTransfer.mutate(t)}
                            disabled={applyTransfer.isPending || !t.coureur_id || !t.equipe_id}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Appliquer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patch.mutate({ id: t.id, values: { statut: "ignore" } })}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Ignorer
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            patch.mutate({
                              id: t.id,
                              values: { statut: "nouveau", applied_at: null },
                            })
                          }
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!createTeamFor} onOpenChange={(o) => !o && setCreateTeamFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer l'équipe</DialogTitle>
            <DialogDescription>
              L'équipe sera créée et rattachée à la saison {createTeamFor?.target_year}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input
                value={teamForm.nom}
                onChange={(e) => setTeamForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Trigramme</Label>
                <Input
                  value={teamForm.trigramme}
                  maxLength={5}
                  onChange={(e) =>
                    setTeamForm((f) => ({ ...f, trigramme: e.target.value.toUpperCase() }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Select
                  value={teamForm.categorie}
                  onValueChange={(v) => setTeamForm((f) => ({ ...f, categorie: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTeamFor(null)}>
              Annuler
            </Button>
            <Button onClick={() => createTeam.mutate()} disabled={createTeam.isPending}>
              {createTeam.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
