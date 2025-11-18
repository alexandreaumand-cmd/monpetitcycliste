import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { CreateTeamDialog } from "./CreateTeamDialog";

interface MissingTeamsSectionProps {
  saisonId: string;
  onTeamCreated: () => void;
}

export const MissingTeamsSection = ({ saisonId, onTeamCreated }: MissingTeamsSectionProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const { data: missingTeams, isLoading } = useQuery({
    queryKey: ['missing-teams', saisonId],
    queryFn: async () => {
      const { data: unmatchedEntries } = await supabase
        .from('startlist_entries')
        .select('source_team, startlist_imports!inner(race_id, courses!inner(phase_id, phases!inner(saison_id)))')
        .eq('startlist_imports.courses.phases.saison_id', saisonId)
        .not('source_team', 'is', null);

      if (!unmatchedEntries) return [];

      const distinctTeams = [...new Set(unmatchedEntries.map((e: any) => e.source_team))];
      const missing = [];

      for (const team of distinctTeams) {
        const { data: exists } = await supabase
          .from('equipes_saisons')
          .select('id')
          .eq('saison_id', saisonId)
          .ilike('trigramme', team)
          .single();

        if (!exists) {
          const count = unmatchedEntries.filter((e: any) => e.source_team === team).length;
          missing.push({ team, count });
        }
      }

      return missing;
    },
    enabled: !!saisonId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!missingTeams || missingTeams.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Équipes manquantes ({missingTeams.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {missingTeams.map(({ team, count }) => (
            <div key={team} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{team}</Badge>
                <span className="text-sm text-muted-foreground">
                  ({count} coureur{count > 1 ? 's' : ''})
                </span>
              </div>
              <Button size="sm" onClick={() => setSelectedTeam(team)}>
                Créer équipe
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedTeam && (
        <CreateTeamDialog
          sourceTeam={selectedTeam}
          saisonId={saisonId}
          onClose={() => setSelectedTeam(null)}
          onSuccess={() => {
            setSelectedTeam(null);
            onTeamCreated();
          }}
        />
      )}
    </>
  );
};
