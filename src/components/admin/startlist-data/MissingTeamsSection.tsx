import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, X, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { CreateTeamDialog } from "./CreateTeamDialog";
import { toast } from "sonner";

interface MissingTeamsSectionProps {
  saisonId: string;
  onTeamCreated: () => void;
}

export const MissingTeamsSection = ({ saisonId, onTeamCreated }: MissingTeamsSectionProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [dismissedTeams, setDismissedTeams] = useState<string[]>([]);

  // Load dismissed teams from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`dismissed-teams-${saisonId}`);
    if (stored) {
      setDismissedTeams(JSON.parse(stored));
    } else {
      setDismissedTeams([]);
    }
  }, [saisonId]);

  const handleDismissTeam = (team: string) => {
    const updated = [...dismissedTeams, team];
    setDismissedTeams(updated);
    localStorage.setItem(`dismissed-teams-${saisonId}`, JSON.stringify(updated));
    toast.success(`"${team}" masquée de la liste`);
  };

  const handleRestoreAll = () => {
    setDismissedTeams([]);
    localStorage.removeItem(`dismissed-teams-${saisonId}`);
    toast.success("Toutes les équipes masquées ont été restaurées");
  };
  // Helper function to clean team names (remove suffixes like (WT), (PRT), (CT))
  const cleanTeamName = (name: string) => {
    return name
      .replace(/\s*\(WT\)\s*$/i, '')
      .replace(/\s*\(PRT\)\s*$/i, '')
      .replace(/\s*\(CT\)\s*$/i, '')
      .replace(/\s*\(DT\)\s*$/i, '')
      .trim()
      .toLowerCase();
  };

  const { data: missingTeams, isLoading } = useQuery({
    queryKey: ['missing-teams', saisonId],
    queryFn: async () => {
      // 1. Fetch all unmatched entries for the season
      const { data: unmatchedEntries } = await supabase
        .from('startlist_entries')
        .select('source_team, startlist_imports!inner(race_id, courses!inner(phase_id, phases!inner(saison_id)))')
        .eq('startlist_imports.courses.phases.saison_id', saisonId)
        .not('source_team', 'is', null);

      if (!unmatchedEntries) return [];

      // 2. Fetch ALL teams for the season in a single query (with equipes join)
      const { data: seasonTeams } = await supabase
        .from('equipes_saisons')
        .select('id, trigramme, nom_affiche, equipes!inner(code_court, nom_complet)')
        .eq('saison_id', saisonId);

      if (!seasonTeams) return [];

      // 3. Create normalized sets for fast comparison
      const normalizedTeams = new Set<string>();
      for (const team of seasonTeams) {
        if (team.trigramme) normalizedTeams.add(team.trigramme.toLowerCase());
        if (team.equipes?.code_court) normalizedTeams.add(team.equipes.code_court.toLowerCase());
        if (team.nom_affiche) normalizedTeams.add(team.nom_affiche.toLowerCase());
        if (team.equipes?.nom_complet) normalizedTeams.add(team.equipes.nom_complet.toLowerCase());
      }

      // 4. Check which teams are truly missing
      const distinctTeams = [...new Set(unmatchedEntries.map((e: any) => e.source_team))];
      const missing = [];

      for (const team of distinctTeams) {
        const cleaned = cleanTeamName(team);
        
        // Exact match check
        const exactMatch = normalizedTeams.has(cleaned);
        
        // Partial match check (if cleaned name is contained in an existing team or vice versa)
        const partialMatch = !exactMatch && 
          [...normalizedTeams].some(t => t.includes(cleaned) || cleaned.includes(t));

        if (!exactMatch && !partialMatch) {
          const count = unmatchedEntries.filter((e: any) => e.source_team === team).length;
          missing.push({ team, count });
        }
      }

      return missing.sort((a, b) => b.count - a.count);
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

  // Filter out dismissed teams
  const visibleTeams = missingTeams?.filter(({ team }) => !dismissedTeams.includes(team)) || [];

  if (visibleTeams.length === 0 && dismissedTeams.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Équipes manquantes ({visibleTeams.length})
            </div>
            {dismissedTeams.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleRestoreAll} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                Restaurer ({dismissedTeams.length})
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Toutes les équipes ont été masquées.
            </p>
          ) : (
            visibleTeams.map(({ team, count }) => (
              <div key={team} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{team}</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({count} coureur{count > 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDismissTeam(team)}
                    title="Masquer cette équipe"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button size="sm" onClick={() => setSelectedTeam(team)}>
                    Créer équipe
                  </Button>
                </div>
              </div>
            ))
          )}
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
