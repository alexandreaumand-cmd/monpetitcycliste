import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatClassementLabel } from "@/lib/stringUtils";

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

export const TeamsDesktop = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('points_desc');
  const [searchManager, setSearchManager] = useState('');
  const [searchRider, setSearchRider] = useState('');
  
  // Phase state
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Expanded rows
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  
  // Drawer for team detail
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  }, [selectedPhaseId, sortBy, searchManager, searchRider]);

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
          search_rider: searchRider || null,
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

  const toggleExpanded = (managerId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedTeams(newExpanded);
  };

  const openTeamDetail = async (team: TeamItem) => {
    setSelectedTeam(team);
    setDrawerOpen(true);
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
    return `Phase ${phase.index_dans_saison} • ${new Date(phase.date_debut).toLocaleDateString('fr-FR', { month: 'short' })} - ${new Date(phase.date_fin).toLocaleDateString('fr-FR', { month: 'short' })}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading && teams.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Équipes</h1>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une phase" />
              </SelectTrigger>
              <SelectContent>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {getPhaseLabel(phase)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un manager..."
                value={searchManager}
                onChange={(e) => setSearchManager(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un coureur..."
                value={searchRider}
                onChange={(e) => setSearchRider(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points_desc">Points (décroissant)</SelectItem>
                <SelectItem value="rank_asc">Rang (croissant)</SelectItem>
                <SelectItem value="name_asc">Nom (A-Z)</SelectItem>
                <SelectItem value="points_30_desc">Points 30j</SelectItem>
                <SelectItem value="scorers_desc">Scorers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Teams Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {teams.length} équipe{teams.length > 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rang</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Moy/course</TableHead>
                <TableHead className="text-right">Courses</TableHead>
                <TableHead>Top coureur</TableHead>
                <TableHead>Scorers</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => {
                const isExpanded = expandedTeams.has(team.manager_id);
                return (
                  <Collapsible
                    key={team.manager_id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(team.manager_id)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {getRankIcon(team.rank)}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openTeamDetail(team);
                              }}
                              className="font-semibold hover:underline text-left"
                            >
                              {team.manager_nom}
                            </button>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {team.points_total}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {team.avg_per_course}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {team.courses_scored}
                          </TableCell>
                          <TableCell>
                            {team.top_rider && (
                              <Badge variant="secondary" className="text-xs">
                                {team.top_rider.nom} ({team.top_rider.points})
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-6">
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm">
                                Scorers ({team.scorers_count})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {team.scorers.map((scorer) => (
                                  <Card key={scorer.rider_id} className="p-3">
                                    <div className="space-y-1">
                                      <div className="font-semibold text-sm">{scorer.nom}</div>
                                      <div className="text-xs text-muted-foreground">{scorer.equipe}</div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-primary">
                                          {scorer.points_total} pts
                                        </span>
                                        <span className="text-muted-foreground">
                                          {scorer.nb_courses} course{scorer.nb_courses > 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      {scorer.last_scored_at && (
                                        <div className="text-xs text-muted-foreground">
                                          Dernier: {new Date(scorer.last_scored_at).toLocaleDateString('fr-FR')}
                                        </div>
                                      )}
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>

          {teams.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              Aucune équipe trouvée
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Detail Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{selectedTeam?.manager_nom}</DrawerTitle>
            <DrawerDescription>
              Détail complet de l'équipe
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{selectedTeam?.points_total}</div>
                      <div className="text-xs text-muted-foreground">Points totaux</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{selectedTeam?.scorers_count}</div>
                      <div className="text-xs text-muted-foreground">Scorers</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{getRankIcon(selectedTeam?.rank || 0)}</div>
                      <div className="text-xs text-muted-foreground">Rang</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Scorers with breakdown */}
                {teamDetailScorers.map((scorer) => (
                  <Card key={scorer.rider_id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <div>
                          <div>{scorer.nom}</div>
                          <div className="text-sm text-muted-foreground font-normal">{scorer.equipe}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-primary">{scorer.points_total} pts</div>
                          <div className="text-xs text-muted-foreground">{scorer.nb_courses} courses</div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {scorer.breakdown && scorer.breakdown.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Course</TableHead>
                              <TableHead>Classement</TableHead>
                              <TableHead className="text-right">Points</TableHead>
                              <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {scorer.breakdown.map((entry, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">{entry.course_nom}</TableCell>
                                <TableCell className="text-sm">
                                  <Badge variant="outline" className="text-xs">
                                    {formatClassementLabel(entry.type_classement, entry.etape_numero)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  {entry.points}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {new Date(entry.date_classement).toLocaleDateString('fr-FR')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          <DrawerClose asChild>
            <Button variant="outline" className="mx-6 mb-6">
              Fermer
            </Button>
          </DrawerClose>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
