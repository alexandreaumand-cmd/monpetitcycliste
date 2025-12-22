import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface LeagueMemberSponsorsManagerProps {
  leagueId: string;
}

export const LeagueMemberSponsorsManager = ({ leagueId }: LeagueMemberSponsorsManagerProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const leagueClient = useLeagueClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  // Get the season associated with this league
  const { data: leagueScope, isLoading: scopeLoading } = useQuery({
    queryKey: ['league-scope', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('league_scopes')
        .select('season_id, saisons:season_id(id, annee)')
        .eq('league_id', leagueId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching league scope:', error);
        throw error;
      }
      return data;
    },
    enabled: !!leagueId,
  });

  const seasonId = leagueScope?.season_id;
  const seasonYear = (leagueScope?.saisons as any)?.annee;

  // Get league members with their managers and sponsors for this season
  const { data: membersWithSponsors, isLoading } = useQuery({
    queryKey: ['league-members-sponsors', leagueId, seasonId],
    queryFn: async () => {
      if (!seasonId) return [];

      // Get league members
      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);
      
      if (membersError) throw membersError;

      // Get managers for these users
      const userIds = members?.map(m => m.user_id) || [];
      const { data: managers, error: managersError } = await supabase
        .from('managers')
        .select('id, nom, sponsor, user_id')
        .in('user_id', userIds);
      
      if (managersError) throw managersError;

      // Get season sponsors for these managers
      const managerIds = managers?.map(m => m.id) || [];
      const { data: seasonSponsors, error: sponsorsError } = await supabase
        .from('manager_sponsors')
        .select('*')
        .eq('saison_id', seasonId)
        .in('manager_id', managerIds);
      
      if (sponsorsError) throw sponsorsError;

      return managers?.map(m => ({
        ...m,
        season_sponsor: seasonSponsors?.find(s => s.manager_id === m.id)?.sponsor || '',
        jersey_image_url: seasonSponsors?.find(s => s.manager_id === m.id)?.jersey_image_url || null,
      })) || [];
    },
    enabled: !!seasonId,
  });

  const upsertSponsor = useMutation({
    mutationFn: async ({ managerId, sponsor }: { managerId: string; sponsor: string }) => {
      if (!seasonId) throw new Error('No season ID');
      
      const { error } = await leagueClient
        .from('manager_sponsors')
        .upsert({
          manager_id: managerId,
          saison_id: seasonId,
          sponsor,
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-members-sponsors'] });
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

  const handleSponsorChange = (managerId: string, value: string) => {
    setPendingChanges(prev => ({ ...prev, [managerId]: value }));
  };

  const handleSaveSponsor = (managerId: string) => {
    const sponsor = pendingChanges[managerId];
    if (sponsor !== undefined) {
      upsertSponsor.mutate({ managerId, sponsor });
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[managerId];
        return next;
      });
    }
  };

  if (scopeLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sponsors des membres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!seasonId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sponsors des membres</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aucune saison associée à cette ligue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsors des membres (Saison {seasonYear})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Définissez le sponsor de chaque membre pour la saison {seasonYear}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr,1fr,auto] gap-4 items-center font-medium text-sm text-muted-foreground pb-2 border-b">
              <div>Manager</div>
              <div>Sponsor</div>
              <div></div>
            </div>
            {membersWithSponsors?.map(manager => {
              const currentValue = pendingChanges[manager.id] ?? manager.season_sponsor;
              const hasChanges = pendingChanges[manager.id] !== undefined && 
                                 pendingChanges[manager.id] !== manager.season_sponsor;
              
              return (
                <div key={manager.id} className="grid grid-cols-[1fr,1fr,auto] gap-4 items-center">
                  <span className="font-medium">{manager.nom}</span>
                  <Input
                    value={currentValue}
                    onChange={(e) => handleSponsorChange(manager.id, e.target.value)}
                    placeholder={manager.sponsor || "Entrer un sponsor"}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && hasChanges) {
                        handleSaveSponsor(manager.id);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveSponsor(manager.id)}
                    disabled={!hasChanges || upsertSponsor.isPending}
                  >
                    {upsertSponsor.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
            {membersWithSponsors?.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Aucun membre dans cette ligue
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
