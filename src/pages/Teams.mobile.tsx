import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MobileCard, MobileEmptyState, MobileHeader, KPIRow } from "@/components/mobile";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface TeamScorer {
  rider_id: string;
  nom: string;
  equipe: string;
  points_total: number;
  nb_courses: number;
  last_scored_at: string | null;
  breakdown?: Array<{
    course_nom: string;
    type_classement: string;
    etape_numero: number | null;
    points: number;
    date_classement: string;
  }>;
}

interface TeamItem {
  manager_id: string;
  manager_nom: string;
  rank: number;
  points_total: number;
  points_30d: number;
  courses_scored: number;
  avg_per_course: number;
  top_rider: { rider_id: string; nom: string; points: number } | null;
  scorers: TeamScorer[];
  scorers_count: number;
}

interface Phase {
  id: string;
  index_dans_saison: number;
  date_debut: string;
  date_fin: string;
  statut: 'draft' | 'active' | 'completed' | 'auction_open' | 'auction_closed';
}

type SortBy = 'points_desc' | 'rank_asc' | 'name_asc' | 'points_30_desc' | 'scorers_desc';

const formatClassementLabel = (type: string, etape?: number | null): string => {
  if (type === 'Etape' && etape) {
    return `Étape ${etape}`;
  }
  const labels: Record<string, string> = {
    'GC': 'CG',
    'Points': 'Points',
    'Montagne': 'Montagne',
    'Jeune': 'Jeunes',
  };
  return labels[type] || type;
};

export const TeamsMobile = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('points_desc');
  const [searchManager, setSearchManager] = useState('');
  
  // Phase state
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Filters sheet
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Team detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [teamDetailScorers, setTeamDetailScorers] = useState<TeamScorer[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadPhases();
  }, []);

  useEffect(() => {
    if (selectedPhaseId) {
      loadTeams();
    }
  }, [selectedPhaseId, sortBy, searchManager]);

  const loadPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .order('date_debut', { ascending: false });

      if (error) throw error;

      setPhases(data || []);
      
      // Select active phase or first phase
      const activePhase = data?.find(p => p.statut === 'active');
      setSelectedPhaseId(activePhase?.id || data?.[0]?.id || null);
    } catch (error: any) {
      console.error('Error loading phases:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les phases"
      });
    }
  };

  const loadTeams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('teams-overview', {
        body: {
          phase_id: selectedPhaseId,
          search_manager: searchManager || null,
          sort: sortBy,
          limit: 100,
          offset: 0
        }
      });

      if (error) throw error;

      setTeams(data.items || []);
    } catch (error: any) {
      console.error('Error loading teams:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les équipes"
      });
    } finally {
      setLoading(false);
    }
  };

  const openTeamDetail = async (team: TeamItem) => {
    setSelectedTeam(team);
    setDetailOpen(true);
    setLoadingDetail(true);

    try {
      const { data, error } = await supabase.functions.invoke('team-detail', {
        body: {
          manager_id: team.manager_id,
          phase_id: selectedPhaseId
        }
      });

      if (error) throw error;

      setTeamDetailScorers(data.scorers || []);
    } catch (error: any) {
      console.error('Error loading team detail:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger le détail de l'équipe"
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const getPhaseLabel = (phase: Phase) => {
    return `Phase ${phase.index_dans_saison}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getSortLabel = (sort: SortBy) => {
    const labels: Record<SortBy, string> = {
      'points_desc': 'Points ↓',
      'rank_asc': 'Rang ↑',
      'name_asc': 'Nom A-Z',
      'points_30_desc': 'Points 30j',
      'scorers_desc': 'Scorers ↓'
    };
    return labels[sort] || sort;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-lg font-bold">Équipes</h1>
        <p className="text-xs text-muted-foreground">{teams.length} équipe{teams.length > 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-4 pt-4 space-y-4">
        {/* Quick filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un manager..."
              value={searchManager}
              onChange={(e) => setSearchManager(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(true)}
              className="flex-1"
            >
              <ChevronDown className="mr-2 h-4 w-4" />
              Filtres
            </Button>
            <Badge variant="secondary" className="text-xs py-1 px-2">
              {selectedPhaseId && getPhaseLabel(phases.find(p => p.id === selectedPhaseId)!)}
            </Badge>
            <Badge variant="secondary" className="text-xs py-1 px-2">
              {getSortLabel(sortBy)}
            </Badge>
          </div>
        </div>

        {/* Teams list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Aucune équipe trouvée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <MobileCard
                key={team.manager_id}
                title={team.manager_nom}
                onClick={() => openTeamDetail(team)}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getRankIcon(team.rank)}</span>
                        <h3 className="font-semibold">{team.manager_nom}</h3>
                      </div>
                      {team.top_rider && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Top: {team.top_rider.nom} ({team.top_rider.points} pts)
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {team.points_total}
                      </div>
                      <div className="text-xs text-muted-foreground">points</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold">{team.avg_per_course}</div>
                      <div className="text-xs text-muted-foreground">Moy/course</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{team.courses_scored}</div>
                      <div className="text-xs text-muted-foreground">Courses</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{team.scorers_count}</div>
                      <div className="text-xs text-muted-foreground">Scorers</div>
                    </div>
                  </div>

                  {/* Scorers chips */}
                  <div className="flex flex-wrap gap-1">
                    {team.scorers.slice(0, 3).map((scorer) => (
                      <Badge key={scorer.rider_id} variant="outline" className="text-xs">
                        {scorer.nom}
                      </Badge>
                    ))}
                    {team.scorers_count > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{team.scorers_count - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        )}
      </div>

      {/* Filters Sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="h-[400px]">
          <SheetHeader>
            <SheetTitle>Filtres</SheetTitle>
            <SheetDescription>Personnalisez l'affichage</SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 mt-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Phase</label>
              <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {getPhaseLabel(phase)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tri</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points_desc">Points (décroissant)</SelectItem>
                  <SelectItem value="rank_asc">Rang (croissant)</SelectItem>
                  <SelectItem value="name_asc">Nom (A-Z)</SelectItem>
                  <SelectItem value="points_30_desc">Points 30 jours</SelectItem>
                  <SelectItem value="scorers_desc">Scorers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => setFiltersOpen(false)} 
              className="w-full"
            >
              Appliquer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Team Detail Sheet */}
      <MobileBottomSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selectedTeam?.manager_nom || ''}
        description="Détail de l'équipe"
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* KPIs */}
            <KPIRow
              items={[
                { label: 'Points', value: selectedTeam?.points_total || 0 },
                { label: 'Scorers', value: selectedTeam?.scorers_count || 0 },
                { label: 'Rang', value: getRankIcon(selectedTeam?.rank || 0) }
              ]}
            />

            {/* Scorers */}
            {teamDetailScorers.map((scorer) => (
              <Card key={scorer.rider_id} className="p-4">
                <div className="space-y-3">
                  {/* Scorer header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{scorer.nom}</div>
                      <div className="text-xs text-muted-foreground">{scorer.equipe}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">
                        {scorer.points_total}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {scorer.nb_courses} courses
                      </div>
                    </div>
                  </div>

                  {/* Breakdown */}
                  {scorer.breakdown && scorer.breakdown.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Détail des points</div>
                      {scorer.breakdown.map((entry, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-xs">{entry.course_nom}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatClassementLabel(entry.type_classement, entry.etape_numero)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{entry.points}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(entry.date_classement).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
};
