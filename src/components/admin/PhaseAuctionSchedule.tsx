import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Save } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function PhaseAuctionSchedule() {
  const queryClient = useQueryClient();

  // Get current season
  const { data: season } = useQuery({
    queryKey: ['admin-current-season'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Get phases
  const { data: phases = [] } = useQuery({
    queryKey: ['admin-phases', season?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, index_dans_saison, date_debut, date_fin, statut')
        .eq('saison_id', season!.id)
        .order('index_dans_saison');
      if (error) throw error;
      return data || [];
    },
    enabled: !!season?.id,
  });

  // Get existing schedule
  const { data: schedules = [] } = useQuery({
    queryKey: ['phase-auction-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phase_auction_schedule')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const [dates, setDates] = useState<Record<string, string>>({});

  // Initialize dates from existing schedule
  const getScheduleDate = (phaseId: string) => {
    if (dates[phaseId] !== undefined) return dates[phaseId];
    const existing = schedules.find(s => s.phase_id === phaseId);
    return existing ? existing.auction_opens_at.slice(0, 16) : '';
  };

  const saveMutation = useMutation({
    mutationFn: async ({ phaseId, dateStr }: { phaseId: string; dateStr: string }) => {
      const existing = schedules.find(s => s.phase_id === phaseId);
      if (existing) {
        const { error } = await supabase
          .from('phase_auction_schedule')
          .update({ auction_opens_at: new Date(dateStr).toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('phase_auction_schedule')
          .insert({ phase_id: phaseId, auction_opens_at: new Date(dateStr).toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase-auction-schedule'] });
      toast.success('Date sauvegardée');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erreur');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Planning enchères par phase
          {season && <Badge variant="secondary">Saison {season.annee}</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ces dates s'appliquent à toutes les ligues en mode 5 Phases. La date du premier tour est fixée par le créateur de la ligue.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {phases.map((phase) => {
            const dateValue = getScheduleDate(phase.id);
            return (
              <div key={phase.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex-shrink-0 w-24">
                  <Badge variant={phase.statut === 'active' ? 'default' : 'outline'}>
                    Phase {phase.index_dans_saison}
                  </Badge>
                </div>
                <div className="flex-1 text-sm text-muted-foreground">
                  {phase.date_debut && format(new Date(phase.date_debut), 'dd MMM', { locale: fr })}
                  {' → '}
                  {phase.date_fin && format(new Date(phase.date_fin), 'dd MMM yyyy', { locale: fr })}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Début enchères :</Label>
                  <Input
                    type="datetime-local"
                    value={dateValue}
                    onChange={(e) => setDates(prev => ({ ...prev, [phase.id]: e.target.value }))}
                    className="w-52"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!dateValue || saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ phaseId: phase.id, dateStr: dateValue })}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {phases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune phase trouvée pour cette saison
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
