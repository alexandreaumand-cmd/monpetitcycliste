import { Card, CardContent } from "@/components/ui/card";
import { Database, CheckCircle2, AlertCircle, XCircle, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StartlistStatsProps {
  entries: any[];
  saisonId?: string;
}

export const StartlistStats = ({ entries, saisonId }: StartlistStatsProps) => {
  const { data: missingTeams } = useQuery({
    queryKey: ['missing-teams-count', saisonId],
    queryFn: async () => {
      if (!saisonId) return [];
      
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

  const stats = {
    total: entries?.length || 0,
    matched: entries?.filter((e) => e.coureur_id).length || 0,
    unmatched: entries?.filter((e) => !e.coureur_id && e.status !== 'off_roster').length || 0,
    offRoster: entries?.filter((e) => e.status === 'off_roster').length || 0,
    missingTeams: missingTeams?.length || 0,
  };

  const StatCard = ({ label, value, icon, variant = 'default' }: any) => {
    const variants = {
      default: 'text-foreground',
      success: 'text-green-600',
      warning: 'text-bordure-gold',
      destructive: 'text-red-600',
      muted: 'text-muted-foreground',
    };

    return (
      <div className="flex items-center space-x-3">
        <div className={variants[variant]}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6">
        <StatCard label="Total" value={stats.total} icon={<Database className="h-6 w-6" />} />
        <StatCard label="Matchés" value={stats.matched} icon={<CheckCircle2 className="h-6 w-6" />} variant="success" />
        <StatCard label="Non matchés" value={stats.unmatched} icon={<AlertCircle className="h-6 w-6" />} variant="warning" />
        <StatCard label="Hors effectif" value={stats.offRoster} icon={<XCircle className="h-6 w-6" />} variant="muted" />
        <StatCard label="Équipes manquantes" value={stats.missingTeams} icon={<Building2 className="h-6 w-6" />} variant="destructive" />
      </CardContent>
    </Card>
  );
};
