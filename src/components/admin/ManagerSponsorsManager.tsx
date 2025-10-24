import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const ManagerSponsorsManager = () => {
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const leagueClient = useLeagueClient();

  const { data: seasons, isLoading: seasonsLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: managersWithSponsors, isLoading: managersLoading } = useQuery({
    queryKey: ['managers-sponsors', selectedSeason],
    queryFn: async () => {
      if (!selectedSeason) return [];
      
      const { data: managers, error: managersError } = await supabase
        .from('managers')
        .select('id, nom, sponsor')
        .order('nom');
      
      if (managersError) throw managersError;
      
      const { data: seasonSponsors, error: sponsorsError } = await supabase
        .from('manager_sponsors')
        .select('*')
        .eq('saison_id', selectedSeason);
      
      if (sponsorsError) throw sponsorsError;
      
      return managers?.map(m => ({
        ...m,
        season_sponsor: seasonSponsors?.find(s => s.manager_id === m.id)?.sponsor || '',
      })) || [];
    },
    enabled: !!selectedSeason,
  });

  const upsertSponsor = useMutation({
    mutationFn: async ({ managerId, sponsor }: { managerId: string; sponsor: string }) => {
      const { error } = await leagueClient
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: selectedSeason,
          sponsor,
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers-sponsors'] });
      toast({
        title: "Sponsor mis à jour",
        description: "Le sponsor a été enregistré avec succès",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le sponsor",
        variant: "destructive",
      });
      console.error('Error upserting sponsor:', error);
    },
  });

  if (seasonsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gérer les sponsors par saison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Définissez un sponsor spécifique pour chaque manager et chaque saison
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Saison</label>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une saison" />
            </SelectTrigger>
            <SelectContent>
              {seasons?.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  Saison {s.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSeason && (
          <div className="space-y-4">
            {managersLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[200px,1fr,auto] gap-4 items-center font-medium text-sm text-muted-foreground pb-2 border-b">
                  <div>Manager</div>
                  <div>Sponsor pour cette saison</div>
                  <div>Sponsor par défaut</div>
                </div>
                {managersWithSponsors?.map(manager => (
                  <div key={manager.id} className="grid grid-cols-[200px,1fr,auto] gap-4 items-center">
                    <span className="font-medium">{manager.nom}</span>
                    <Input
                      defaultValue={manager.season_sponsor}
                      placeholder="Entrer un sponsor"
                      onBlur={(e) => {
                        const newValue = e.target.value.trim();
                        if (newValue !== manager.season_sponsor) {
                          upsertSponsor.mutate({ 
                            managerId: manager.id, 
                            sponsor: newValue 
                          });
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {manager.sponsor ? `(${manager.sponsor})` : '(Aucun)'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
