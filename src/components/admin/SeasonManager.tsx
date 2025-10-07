import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const hasActivePhase = (phases: any[]) => phases?.some((p: any) => p.statut === 'active');

  return (
    <div className="space-y-6">
      {/* Create Season */}
      <Card>
        <CardHeader>
          <CardTitle>Créer une nouvelle saison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Année</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => createSeason.mutate()}
                disabled={createSeason.isPending}
              >
                {createSeason.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-2 h-4 w-4" />
                Créer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Seasons & Phases */}
      {saisons && saisons.length > 0 ? (
        <Accordion type="single" collapsible defaultValue={saisons[0]?.id} className="space-y-4">
          {saisons.map((saison: any) => {
            const phaseCount = saison.phases?.length || 0;
            const isCurrentSeason = hasActivePhase(saison.phases);
            const sortedPhases = saison.phases?.sort((a: any, b: any) => a.index_dans_saison - b.index_dans_saison) || [];

            return (
              <AccordionItem key={saison.id} value={saison.id} className="border rounded-lg">
                <Card className="border-0">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">Saison {saison.annee}</h3>
                        {isCurrentSeason && (
                          <Badge variant="default">Courante</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {phaseCount} phase{phaseCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-4 pt-0">
                      {/* Create Phase Form */}
                      <div className="border-b pb-4">
                        <h3 className="font-semibold mb-4">Créer une nouvelle phase</h3>
                        <div className="grid gap-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Index</Label>
                              <Input
                                type="number"
                                value={phaseIndex}
                                onChange={(e) => setPhaseIndex(e.target.value)}
                                min="1"
                              />
                            </div>
                            <div>
                              <Label>Date début</Label>
                              <Input
                                type="date"
                                value={dateDebut}
                                onChange={(e) => setDateDebut(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Date fin</Label>
                              <Input
                                type="date"
                                value={dateFin}
                                onChange={(e) => setDateFin(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Budget</Label>
                              <Input
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

                      {/* Existing Phases */}
                      <div>
                        <h3 className="font-semibold mb-3">Phases existantes</h3>
                        {sortedPhases.length > 0 ? (
                          <div className="space-y-2">
                            {sortedPhases.map((phase: any) => (
                              <div
                                key={phase.id}
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
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
                                  {phase.statut === 'active' ? 'Désactiver' : 'Activer'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-4">
                            Aucune phase créée pour cette saison
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Aucune saison créée. Créez une saison pour commencer.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
