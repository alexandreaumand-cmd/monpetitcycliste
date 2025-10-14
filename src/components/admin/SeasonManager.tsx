import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar, CheckCircle, Play, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { SeasonDeleteManager } from "./SeasonDeleteManager";

export const SeasonManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [phaseIndex, setPhaseIndex] = useState("1");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [budget, setBudget] = useState("2200");

  const { data: saisons, isLoading } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*, phases(*)')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const createSeason = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .insert({ annee: parseInt(year) })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saisons'] });
      toast({
        title: "Saison créée",
        description: `Saison ${year} créée avec succès`
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createPhase = useMutation({
    mutationFn: async (saisonId: string) => {
      if (!dateDebut || !dateFin) {
        throw new Error("Veuillez remplir toutes les dates");
      }

      const { error } = await supabase
        .from('phases')
        .insert({
          saison_id: saisonId,
          index_dans_saison: parseInt(phaseIndex),
          date_debut: dateDebut,
          date_fin: dateFin,
          budget: parseFloat(budget),
          statut: 'active'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saisons'] });
      queryClient.invalidateQueries({ queryKey: ['phases'] });
      toast({
        title: "Phase créée",
        description: "La phase a été créée et activée"
      });
      setPhaseIndex((prev) => (parseInt(prev) + 1).toString());
      setDateDebut("");
      setDateFin("");
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const togglePhaseStatus = useMutation({
    mutationFn: async ({ phaseId, currentStatus }: { phaseId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'completed' : 'active';
      const { error } = await supabase
        .from('phases')
        .update({ statut: newStatus })
        .eq('id', phaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saisons'] });
      queryClient.invalidateQueries({ queryKey: ['phases'] });
      toast({
        title: "Statut mis à jour",
        description: "Le statut de la phase a été modifié"
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Categorize seasons
  const categorizedSeasons = useMemo(() => {
    if (!saisons) return { past: [], current: null, future: [] };
    
    const past: any[] = [];
    const future: any[] = [];
    let current: any = null;

    saisons.forEach((saison: any) => {
      const hasActivePhase = saison.phases?.some((p: any) => p.statut === 'active');
      const allCompleted = saison.phases?.length > 0 && saison.phases.every((p: any) => p.statut === 'completed');
      const noPhases = !saison.phases || saison.phases.length === 0;

      if (hasActivePhase) {
        current = saison;
      } else if (allCompleted) {
        past.push(saison);
      } else if (noPhases) {
        future.push(saison);
      }
    });

    return { past, current, future };
  }, [saisons]);

  // Calculate current season progress
  const currentSeasonProgress = useMemo(() => {
    if (!categorizedSeasons.current) return 0;
    const phases = categorizedSeasons.current.phases || [];
    const completed = phases.filter((p: any) => p.statut === 'completed').length;
    return phases.length > 0 ? (completed / phases.length) * 100 : 0;
  }, [categorizedSeasons.current]);

  // Sort seasons for tabs (current first, then desc)
  const sortedSeasonsForTabs = useMemo(() => {
    if (!saisons) return [];
    const sorted = [...saisons];
    if (categorizedSeasons.current) {
      const currentIndex = sorted.findIndex((s: any) => s.id === categorizedSeasons.current.id);
      if (currentIndex > 0) {
        const [current] = sorted.splice(currentIndex, 1);
        sorted.unshift(current);
      }
    }
    return sorted;
  }, [saisons, categorizedSeasons.current]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Season Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Past Seasons */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Saisons passées</CardTitle>
            </div>
            <CardDescription>Toutes les phases terminées</CardDescription>
          </CardHeader>
          <CardContent>
            {categorizedSeasons.past.length > 0 ? (
              <div className="space-y-1">
                {categorizedSeasons.past.map((saison: any) => (
                  <div key={saison.id} className="text-sm text-muted-foreground">
                    {saison.annee} ({saison.phases?.length || 0} phases)
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune saison terminée</p>
            )}
          </CardContent>
        </Card>

        {/* Current Season */}
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Saison en cours</CardTitle>
            </div>
            <CardDescription>Phase active</CardDescription>
          </CardHeader>
          <CardContent>
            {categorizedSeasons.current ? (
              <div className="space-y-3">
                <div className="text-2xl font-bold">{categorizedSeasons.current.annee}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-medium">{Math.round(currentSeasonProgress)}%</span>
                  </div>
                  <Progress value={currentSeasonProgress} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {categorizedSeasons.current.phases?.length || 0} phases
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune saison active</p>
            )}
          </CardContent>
        </Card>

        {/* Future Seasons */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Saisons à venir</CardTitle>
            </div>
            <CardDescription>Pas encore de phases</CardDescription>
          </CardHeader>
          <CardContent>
            {categorizedSeasons.future.length > 0 ? (
              <div className="space-y-1">
                {categorizedSeasons.future.map((saison: any) => (
                  <div key={saison.id} className="text-sm text-muted-foreground">
                    {saison.annee}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune saison planifiée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Create Season */}
      <Card className="bg-accent/50 border-2 border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            <CardTitle>Lancer une nouvelle saison</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="new-season-year">Année</Label>
              <Input
                id="new-season-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => createSeason.mutate()}
                disabled={createSeason.isPending}
                size="lg"
              >
                {createSeason.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-2 h-4 w-4" />
                Créer la saison {year}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Season Details Tabs */}
      {saisons && saisons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Détails des saisons</CardTitle>
            <CardDescription>Gérer les phases de chaque saison</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={sortedSeasonsForTabs[0]?.id} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
                {sortedSeasonsForTabs.map((saison: any) => {
                  const hasActivePhase = saison.phases?.some((p: any) => p.statut === 'active');
                  return (
                    <TabsTrigger key={saison.id} value={saison.id}>
                      Saison {saison.annee}
                      {hasActivePhase && " (Courante)"}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {sortedSeasonsForTabs.map((saison: any) => {
                const sortedPhases = saison.phases?.sort((a: any, b: any) => a.index_dans_saison - b.index_dans_saison) || [];

                return (
                  <TabsContent key={saison.id} value={saison.id} className="space-y-6 mt-6">
                    {/* Existing Phases */}
                    <div>
                      <h3 className="font-semibold mb-3">Phases existantes</h3>
                      {sortedPhases.length > 0 ? (
                        <div className="space-y-2">
                          {sortedPhases.map((phase: any) => (
                            <div
                              key={phase.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">Phase {phase.index_dans_saison}</span>
                                  <Badge variant={phase.statut === 'active' ? 'default' : 'secondary'}>
                                    {phase.statut}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(phase.date_debut).toLocaleDateString()} - {new Date(phase.date_fin).toLocaleDateString()}
                                  {" • "}{formatAmount(phase.budget)} de budget
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  togglePhaseStatus.mutate({
                                    phaseId: phase.id,
                                    currentStatus: phase.statut
                                  })
                                }
                                disabled={togglePhaseStatus.isPending}
                              >
                                {phase.statut === 'active' ? 'Terminer' : 'Activer'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 border rounded-lg bg-muted/50">
                          <p className="text-muted-foreground">
                            Aucune phase créée pour cette saison
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Create Phase Form */}
                    <div className="border-t pt-6">
                      <h3 className="font-semibold mb-4">Créer une nouvelle phase</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor={`phase-index-${saison.id}`}>Index</Label>
                            <Input
                              id={`phase-index-${saison.id}`}
                              type="number"
                              value={phaseIndex}
                              onChange={(e) => setPhaseIndex(e.target.value)}
                              min="1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`date-debut-${saison.id}`}>Date début</Label>
                            <Input
                              id={`date-debut-${saison.id}`}
                              type="date"
                              value={dateDebut}
                              onChange={(e) => setDateDebut(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`date-fin-${saison.id}`}>Date fin</Label>
                            <Input
                              id={`date-fin-${saison.id}`}
                              type="date"
                              value={dateFin}
                              onChange={(e) => setDateFin(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`budget-${saison.id}`}>Budget</Label>
                            <Input
                              id={`budget-${saison.id}`}
                              type="number"
                              value={budget}
                              onChange={(e) => setBudget(e.target.value)}
                              step="100"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              onClick={() => createPhase.mutate(saison.id)}
                              disabled={createPhase.isPending || !dateDebut || !dateFin}
                              className="w-full"
                            >
                              {createPhase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              <Calendar className="mr-2 h-4 w-4" />
                              Créer la phase
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Aucune saison créée. Utilisez le formulaire ci-dessus pour créer votre première saison.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <SeasonDeleteManager />
    </div>
  );
};
